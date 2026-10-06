import { Run } from "@effected/commands";
import type { Target } from "@pluginfinity/core";
import type { KnownTargetId, PluginfinityConfig } from "@pluginfinity/targets";
import { KNOWN_TARGET_IDS, TARGETS } from "@pluginfinity/targets";
import type { PlatformError } from "effect";
import { Effect, FileSystem, Path, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { ChildProcess } from "effect/process";
import type { SourceAgent } from "./agents.js";
import { readAgents, renderAgent } from "./agents.js";
import { isJunk } from "./component.js";
import type { EmitPlan, EmittedFile } from "./emit.js";
import { applyEmit, planEmit } from "./emit.js";
import type { ConfigError } from "./errors.js";
import {
	BuildStale,
	ComponentInvalid,
	ComponentsInvalid,
	HookEventUnsupported,
	HookScriptInvalid,
	HostRejected,
	PackageVersionMissing,
	PathConflict,
	ShippedFileInvalid,
	TargetDrift,
} from "./errors.js";
import { HOOK_LIB_DIR, hookLibFiles } from "./hook-lib.js";
import type { TargetHookEvent } from "./hooks.js";
import { hookCommandFiles, hookScripts, renderHooks, targetHooks } from "./hooks.js";
import type { LoadedConfig } from "./loader.js";
import { pluginName, renderManifest, serializeManifest } from "./manifest.js";
import type { BuildNote } from "./notes.js";
import { CONFIG_NOTE_PATH, sortNotes } from "./notes.js";
import type { ConfigSelection, PreparedPlugin } from "./selection.js";
import { preparePlugins } from "./selection.js";
import { SERVER_LIB_DIR, serverLibFiles } from "./server-lib.js";
import { mcpServerNames, renderServers, serverFiles } from "./servers.js";
import type { SourceSkill } from "./skills.js";
import { readSkills, renderSkill } from "./skills.js";
import type { TokenContext } from "./tokens.js";
import { ENGINE_VERSION } from "./version.js";

/**
 * The input to `build`.
 *
 * @public
 */
export interface BuildInput {
	readonly selection: ConfigSelection;
	readonly targets: ReadonlyArray<KnownTargetId>;
	/** Rebuild in memory and compare with `builds/` instead of writing. */
	readonly check: boolean;
}

/**
 * The input to `validate`.
 *
 * @public
 */
export interface ValidateInput {
	readonly selection: ConfigSelection;
	readonly targets: ReadonlyArray<KnownTargetId>;
	/** Skip the host CLIs and run only pluginfinity's own checks. */
	readonly skipHosts: boolean;
}

/**
 * One target's build of one plugin.
 *
 * @public
 */
export interface TargetBuild {
	/** The config file's absolute path. */
	readonly config: string;
	readonly target: KnownTargetId;
	/** The build directory: `<plugin root>/builds/<id>`. */
	readonly out: string;
	/** How the build directory differed before this run; empty after a write. */
	readonly plan: EmitPlan;
	/** What the target dropped, degraded or omitted, sorted by path (the config last), then kind, then name. */
	readonly notes: ReadonlyArray<BuildNote>;
}

/**
 * One target's validation of one plugin.
 *
 * @public
 */
export interface TargetValidation {
	readonly config: string;
	readonly target: KnownTargetId;
	readonly out: string;
	/** Whether the host CLI checked the build, or `--no-host` skipped it. */
	readonly host: "passed" | "skipped";
	/** The same notes `build` reports for the target. */
	readonly notes: ReadonlyArray<BuildNote>;
}

const PackageVersion = Schema.fromJsonString(Schema.Struct({ version: Schema.String }));

/** The version every manifest copies: `version` in the `package.json` beside the config. */
const readVersion = (root: string): Effect.Effect<string, PackageVersionMissing, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const file = path.join(root, "package.json");
		const text = yield* fs.readFileString(file).pipe(Effect.mapError(() => new PackageVersionMissing({ path: file })));
		const { version } = yield* Schema.decodeUnknownEffect(PackageVersion)(text).pipe(
			Effect.mapError(() => new PackageVersionMissing({ path: file })),
		);
		return version;
	});

interface PlannedTarget extends TargetBuild {
	readonly files: ReadonlyArray<EmittedFile>;
	/** The manifest's `name` and `version`, for the host checks. */
	readonly name: string;
	readonly version: string;
}

const targetOf = (id: KnownTargetId) => {
	const entry = TARGETS.find((candidate) => candidate.id === id);
	if (entry === undefined) throw new Error(`no registry entry for target "${id}"`);
	return entry.target;
};

/**
 * Every failure planning a plugin's builds can produce.
 *
 * @public
 */
export type PlanError =
	| PackageVersionMissing
	| HookEventUnsupported
	| HookScriptInvalid
	| ShippedFileInvalid
	| PathConflict
	| ComponentsInvalid
	| PlatformError.PlatformError;

/** Every file under `dir`, as `/`-separated paths relative to `root`; none when `dir` is absent. */
const sourceFiles = (
	root: string,
	dir: string,
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const absolute = path.join(root, dir);
		if (!(yield* fs.exists(absolute))) return [];
		const files: Array<string> = [];
		for (const entry of yield* fs.readDirectory(absolute, { recursive: true })) {
			if (isJunk(path.basename(entry))) continue;
			if ((yield* fs.stat(path.join(absolute, entry))).type === "File") {
				files.push(`${dir}/${entry.split(path.sep).join("/")}`);
			}
		}
		return files.sort();
	});

/** A source file copied verbatim: its bytes and its own mode. */
const copyFile = (
	root: string,
	file: string,
): Effect.Effect<EmittedFile, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const absolute = path.join(root, file);
		const info = yield* fs.stat(absolute);
		return { path: file, content: yield* fs.readFile(absolute), mode: info.mode & 0o777 };
	});

/** Fail with `HookScriptInvalid` unless `script` exists, and is executable under `exec`. */
const checkScript = (
	config: LoadedConfig,
	script: string,
	invoke: "bash" | "exec",
): Effect.Effect<void, HookScriptInvalid, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const info = yield* fs.stat(path.join(config.root, script)).pipe(Effect.option);
		if (info._tag === "None" || info.value.type !== "File") {
			return yield* Effect.fail(new HookScriptInvalid({ path: config.path, script, problem: "missing" }));
		}
		if (invoke === "exec" && (info.value.mode & 0o111) === 0) {
			return yield* Effect.fail(new HookScriptInvalid({ path: config.path, script, problem: "not-executable" }));
		}
	});

/** Whether `real` is `root` or under it; both are real paths. */
const isInside = (root: string, real: string): boolean => real === root || real.startsWith(`${root}/`);

/** Whether a plugin-relative path has no empty, `.` or `..` segment. */
const isNormal = (file: string): boolean =>
	file.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");

/**
 * A plugin-relative path with its empty, `.` and `..` segments resolved, or
 * `undefined` when it climbs out of the plugin root.
 */
const canonical = (file: string): string | undefined => {
	const segments: Array<string> = [];
	for (const segment of file.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment !== "..") segments.push(segment);
		else if (segments.pop() === undefined) return undefined;
	}
	return segments.join("/");
};

/**
 * The files one canonical, plugin-relative path ships: the file, or every
 * file under the directory. `spelled` is the path as written, which is what
 * is checked for existence, so a trailing `/` after a file fails as missing.
 * Every shipped file must resolve inside the plugin, through any symlink.
 */
const expandShipped = (
	config: LoadedConfig,
	file: string,
	spelled: string,
	referencedBy: string,
): Effect.Effect<
	ReadonlyArray<string>,
	ShippedFileInvalid | PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const fail = (named: string, problem: ShippedFileInvalid["problem"]) =>
			Effect.fail(new ShippedFileInvalid({ path: config.path, file: named, referencedBy, problem }));
		const info = yield* fs.stat(path.join(config.root, spelled)).pipe(Effect.option);
		if (info._tag === "None" || (info.value.type !== "File" && info.value.type !== "Directory")) {
			return yield* fail(spelled, "missing");
		}
		const files = info.value.type === "Directory" ? yield* sourceFiles(config.root, file) : [file];
		const root = yield* fs.realPath(config.root);
		for (const listed of files) {
			// A symlink anywhere under a directory must not reach out of the plugin.
			if (!isInside(root, yield* fs.realPath(path.join(config.root, listed)))) {
				return yield* fail(listed, "outside-root");
			}
		}
		return files;
	});

/**
 * The files `entries` name, each canonical: each file, or every file under
 * each directory. Every one must exist and resolve inside the plugin.
 */
const listedFiles = (
	config: LoadedConfig,
	entries: ReadonlyArray<string>,
): Effect.Effect<
	ReadonlyArray<string>,
	ShippedFileInvalid | PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const fail = (file: string, problem: ShippedFileInvalid["problem"]) =>
			Effect.fail(new ShippedFileInvalid({ path: config.path, file, referencedBy: "files", problem }));
		const out: Array<string> = [];
		// The config schema admits only canonical entries; canonicalise anyway so the
		// reserved-path and collision checks never see a path spelled two ways.
		for (const entry of entries) {
			const file = canonical(entry);
			if (file === undefined) return yield* fail(entry, "outside-root");
			if (file === "") return yield* fail(entry, "not-normal");
			out.push(...(yield* expandShipped(config, file, file, "files")));
		}
		return out;
	});

/**
 * The files a server reference ships, failing with `ShippedFileInvalid`
 * unless it is written without `.`, `..` or empty segments (a directory may
 * end in one `/`) and exists inside the plugin. A file ships alone and a
 * directory ships every file under it, like a `files` entry. A whole
 * `command` must be a file, and executable.
 */
const serverShipped = (
	config: LoadedConfig,
	spelled: string,
	referencedBy: string,
	command: boolean,
): Effect.Effect<
	ReadonlyArray<string>,
	ShippedFileInvalid | PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const fail = (problem: ShippedFileInvalid["problem"]) =>
			Effect.fail(new ShippedFileInvalid({ path: config.path, file: spelled, referencedBy, problem }));
		// The host resolves the path as written, so a `..` through a directory the build
		// does not ship would fail at runtime; only the canonical spelling is accepted.
		const file = spelled.endsWith("/") ? spelled.slice(0, -1) : spelled;
		if (!isNormal(file)) return yield* fail("not-normal");
		if (command) {
			const info = yield* fs.stat(path.join(config.root, file)).pipe(Effect.option);
			if (info._tag === "Some" && info.value.type === "Directory") return yield* fail("directory");
		}
		const files = yield* expandShipped(config, file, spelled, referencedBy);
		if (command) {
			const info = yield* fs.stat(path.join(config.root, file));
			if ((info.mode & 0o111) === 0) return yield* fail("not-executable");
		}
		return files;
	});

/**
 * What a target's skill and agent bodies may name: the skills and agents it
 * builds, every file of those skills, and the plugin's own MCP servers. Agent
 * ids and skill commands use the plugin's name on this target; own MCP tools
 * are named, and their run-time `{plugin}` filled, by its Claude name, which
 * Claude Code namespaces MCP tools with.
 */
const tokenContext = (
	target: Target,
	id: KnownTargetId,
	config: PluginfinityConfig,
	skills: ReadonlyArray<SourceSkill>,
	agents: ReadonlyArray<SourceAgent>,
): TokenContext => {
	const plugin = pluginName(config, id);
	const built = skills.filter((skill) => skill.frontmatter.targets?.[id] !== false);
	return {
		target,
		plugin,
		skills: new Set(built.map((skill) => skill.name)),
		agents: new Set(agents.filter((agent) => agent.frontmatter.targets?.[id] !== false).map((agent) => agent.name)),
		skillFiles: new Set(
			built.flatMap((skill) => [`${skill.name}/SKILL.md`, ...skill.files.map((file) => `${skill.name}/${file}`)]),
		),
		own: { plugin: pluginName(config, "claude"), servers: mcpServerNames(id, config) },
	};
};

/**
 * Render every requested target of one plugin and compare each with its build
 * directory.
 *
 * @remarks
 * Each target ships the source `hooks/` directory whole, so a script can
 * source its own helpers, except scripts only another target's hooks run; a
 * script outside `hooks/` ships to the targets that run it. A target with
 * hooks also gets the hook library under `hooks/lib/pluginfinity/`. That path
 * is always reserved, whether or not the target has hooks: no source file may
 * be at it or under it.
 *
 * Each target also ships the files its local MCP and LSP servers name after
 * `${PLUGIN_ROOT}/` (written without `.` or `..` segments, inside the plugin,
 * and an executable file when a whole `command`; a named directory ships every
 * file under it), and every file the `files` key lists, each once. A target
 * with a local server gets the server library under `lib/pluginfinity/`,
 * which is reserved the same way. A target that writes its servers inline
 * in its manifest also reserves the server file its host loads by default
 * (Claude Code's `.mcp.json` and `.lsp.json`).
 */
const planPlugin = (
	prepared: PreparedPlugin,
): Effect.Effect<ReadonlyArray<PlannedTarget>, PlanError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const path = yield* Path.Path;
		const config = prepared.config;
		const version = yield* readVersion(config.root);
		const invoke = config.config.scripts?.invoke ?? "bash";

		const hooks = prepared.targets.map((id) => {
			const target = targetOf(id);
			return { id, target, ...targetHooks(target, id, config.config) };
		});
		for (const { id, unsupported } of hooks) {
			if (unsupported.length > 0) {
				return yield* Effect.fail(
					new HookEventUnsupported({ path: config.path, target: id, events: unsupported.map((u) => u.event) }),
				);
			}
		}
		// The files each target's hooks run: script paths, and the paths command
		// entries name after ${PLUGIN_ROOT}. A command file is only checked for
		// existence, since the command says how it runs.
		const filesOf = (events: ReadonlyArray<TargetHookEvent>) => [...hookScripts(events), ...hookCommandFiles(events)];
		// Over every enabled target, not just the selected ones, so what a target
		// ships never depends on which targets this run builds.
		const everyScript = new Set(
			config.targets.flatMap((id) => filesOf(targetHooks(targetOf(id), id, config.config).events)),
		);
		for (const { events } of hooks) {
			for (const script of hookScripts(events)) yield* checkScript(config, script, invoke);
			for (const file of hookCommandFiles(events)) yield* checkScript(config, file, "bash");
		}
		const hooksDir = yield* sourceFiles(config.root, "hooks");
		const listed = yield* listedFiles(config, config.config.files ?? []);
		const { skills, failures: skillFailures } = yield* readSkills(config.root, KNOWN_TARGET_IDS);
		const { agents, failures: agentFailures } = yield* readAgents(config.root, KNOWN_TARGET_IDS);
		// Every component problem in the plugin, so one build reports them all.
		const failures: Array<ComponentInvalid> = [...skillFailures, ...agentFailures];
		// A problem that names no target recurs for every target; keep one.
		const keep = (error: ComponentInvalid) => {
			if (!failures.some((seen) => seen.message === error.message)) failures.push(error);
		};
		const collect = <A, R>(
			effect: Effect.Effect<A | undefined, ComponentInvalid | ComponentsInvalid | PlatformError.PlatformError, R>,
		) =>
			effect.pipe(
				Effect.catchTag("ComponentInvalid", (error) => Effect.sync(() => keep(error))),
				Effect.catchTag("ComponentsInvalid", (error) => Effect.sync(() => error.components.forEach(keep))),
			);

		const planned: Array<PlannedTarget> = [];
		for (const { id, target, events, omitted } of hooks) {
			const notes: Array<BuildNote> = omitted.map((event) => ({
				target: id,
				path: CONFIG_NOTE_PATH,
				kind: "hook-omitted",
				name: event,
			}));
			const own = new Set(filesOf(events));
			const servers = serverFiles(target, id, config.config);
			const serverFilesShipped: Array<string> = [];
			for (const file of servers.commands) {
				serverFilesShipped.push(
					...(yield* serverShipped(config, file, servers.owners.get(file) ?? "mcpServers", true)),
				);
			}
			for (const file of servers.others) {
				serverFilesShipped.push(
					...(yield* serverShipped(config, file, servers.owners.get(file) ?? "mcpServers", false)),
				);
			}
			const shipped = [
				...new Set([
					...hooksDir.filter((file) => own.has(file) || !everyScript.has(file)),
					...[...own].filter((script) => !script.startsWith("hooks/")),
					...serverFilesShipped,
					...listed,
				]),
			];
			const copied: Array<EmittedFile> = [];
			for (const file of shipped) copied.push(yield* copyFile(config.root, file));

			// Servers first: a target may place them inline in its manifest.
			const rendered = renderServers(target, id, config.config, pluginName(config.config, id), SERVER_LIB_DIR);
			if (rendered.issues.length > 0) {
				const issue = new ComponentInvalid({ path: config.path, target: id, issues: rendered.issues });
				if (!failures.some((seen) => seen.message === issue.message)) failures.push(issue);
			}
			const manifest = renderManifest(target, id, config.config, version, rendered.manifest);
			const generated: Array<EmittedFile> = [{ path: target.manifest.path, content: serializeManifest(manifest) }];
			const hooksFile = renderHooks(target, events, invoke);
			if (hooksFile !== undefined) {
				generated.push({ path: target.hooks.path, content: hooksFile });
				generated.push(...hookLibFiles(id, String(manifest.name), ENGINE_VERSION));
			}
			generated.push(...rendered.files);
			notes.push(...rendered.notes);
			if (rendered.stdio) generated.push(...serverLibFiles());
			const tokens = tokenContext(target, id, config.config, skills, agents);
			for (const skill of skills) {
				const skillRender = yield* collect(renderSkill(target, id, skill, KNOWN_TARGET_IDS, tokens));
				if (skillRender === undefined) continue;
				generated.push(...skillRender.files);
				notes.push(...skillRender.notes);
			}
			for (const agent of agents) {
				const agentRender = yield* collect(renderAgent(target, id, agent, KNOWN_TARGET_IDS, tokens));
				if (agentRender === undefined) continue;
				generated.push(agentRender.file);
				notes.push(...agentRender.notes);
			}

			// The libraries' directories belong to pluginfinity; a source file there would shadow or join them.
			// A server file the host loads by default is reserved when the target writes those servers inline,
			// since the host would load a shipped one beside them.
			const reservedFiles = new Set(
				[target.mcp.placement, target.lsp.placement].flatMap((placement) =>
					placement._tag === "manifest" ? [placement.reserves] : [],
				),
			);
			const reserved = copied.find(
				(file) =>
					reservedFiles.has(file.path) ||
					[HOOK_LIB_DIR, SERVER_LIB_DIR].some((dir) => file.path === dir || file.path.startsWith(`${dir}/`)),
			);
			if (reserved !== undefined) {
				return yield* Effect.fail(new PathConflict({ path: config.path, target: id, file: reserved.path }));
			}

			const copiedPaths = new Set(copied.map((file) => file.path));
			const conflict = generated.find((file) => copiedPaths.has(file.path));
			if (conflict !== undefined) {
				return yield* Effect.fail(new PathConflict({ path: config.path, target: id, file: conflict.path }));
			}

			const files = [...generated, ...copied];
			const out = path.join(config.root, "builds", id);
			const plan = yield* planEmit(out, files);
			planned.push({
				config: config.path,
				target: id,
				out,
				plan,
				notes: sortNotes(notes),
				files,
				name: String(manifest.name),
				version,
			});
		}
		if (failures.length > 0) {
			return yield* Effect.fail(new ComponentsInvalid({ path: config.path, components: failures }));
		}
		return planned;
	});

/** Fail with `BuildStale` when any target's build directory differs. */
const requireClean = (config: string, planned: ReadonlyArray<PlannedTarget>): Effect.Effect<void, BuildStale> => {
	const drift = planned
		.filter((target) => !target.plan.clean)
		.map(({ target, plan }) =>
			TargetDrift.make({ target, added: plan.added, changed: plan.changed, removed: plan.removed }),
		);
	return drift.length === 0 ? Effect.void : Effect.fail(new BuildStale({ path: config, targets: drift }));
};

/**
 * Regenerate `builds/<id>/` for every selected plugin and target, writing
 * only what differs. With `check`, write nothing and fail with
 * `BuildStale` when anything differs.
 *
 * @public
 */
export const build = (
	input: BuildInput,
): Effect.Effect<ReadonlyArray<TargetBuild>, ConfigError | PlanError | BuildStale, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const builds: Array<TargetBuild> = [];
		for (const prepared of yield* preparePlugins(input)) {
			const planned = yield* planPlugin(prepared);
			if (input.check) yield* requireClean(prepared.config.path, planned);
			else for (const target of planned) yield* applyEmit(target.out, target.files, target.plan);
			for (const { config, target, out, plan, notes } of planned) builds.push({ config, target, out, plan, notes });
		}
		return builds;
	});

const CopilotPluginList = Schema.fromJsonString(
	Schema.Array(
		Schema.Struct({ name: Schema.String, version: Schema.optionalKey(Schema.String), source: Schema.String }),
	),
);

const commandLine = (command: string, args: ReadonlyArray<string>): string => [command, ...args].join(" ");

/** Run a host CLI, turning a spawn failure into `HostRejected`. */
const runHost = (target: PlannedTarget, command: string, args: ReadonlyArray<string>) =>
	Run.collect(ChildProcess.make(command, [...args])).pipe(
		Effect.mapError(
			(error) =>
				new HostRejected({
					path: target.out,
					target: target.target,
					command: commandLine(command, args),
					output: error.message,
				}),
		),
	);

// Each host's own check of a build directory. Claude Code validates the
// directory; Copilot has no validate command, so the check is that it loads
// the directory under the manifest's name and version.
const HOST_CHECKS: Record<
	KnownTargetId,
	(target: PlannedTarget) => Effect.Effect<void, HostRejected, ChildProcessSpawner.ChildProcessSpawner>
> = {
	claude: (target) =>
		Effect.gen(function* () {
			const args = ["plugin", "validate", target.out];
			const output = yield* runHost(target, "claude", args);
			if (output.exitCode !== 0) {
				return yield* Effect.fail(
					new HostRejected({
						path: target.out,
						target: target.target,
						command: commandLine("claude", args),
						output: `${output.stdout}\n${output.stderr}`.trim(),
					}),
				);
			}
		}),
	copilot: (target) =>
		Effect.gen(function* () {
			const args = ["--plugin-dir", target.out, "plugin", "list", "--json"];
			const command = commandLine("copilot", args);
			const reject = (output: string) =>
				Effect.fail(new HostRejected({ path: target.out, target: target.target, command, output }));
			const output = yield* runHost(target, "copilot", args);
			if (output.exitCode !== 0) return yield* reject(`${output.stdout}\n${output.stderr}`.trim());
			const plugins = yield* Schema.decodeUnknownEffect(CopilotPluginList)(output.stdout).pipe(
				Effect.catch(() => reject(`could not read the plugin list: ${output.stdout.trim()}`)),
			);
			const loaded = plugins.find((plugin) => plugin.source === "external" && plugin.name === target.name);
			if (loaded === undefined) return yield* reject(`copilot did not load a plugin named "${target.name}"`);
			if (loaded.version !== target.version) {
				return yield* reject(`copilot loaded version ${loaded.version ?? "(none)"}, expected ${target.version}`);
			}
		}),
};

/**
 * Validate every selected plugin and target: the build directory must match a
 * fresh build, then each host's CLI must accept it unless `skipHosts`.
 *
 * @public
 */
export const validate = (
	input: ValidateInput,
): Effect.Effect<
	ReadonlyArray<TargetValidation>,
	ConfigError | PlanError | BuildStale | HostRejected,
	FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> =>
	Effect.gen(function* () {
		const validations: Array<TargetValidation> = [];
		for (const prepared of yield* preparePlugins(input)) {
			const planned = yield* planPlugin(prepared);
			yield* requireClean(prepared.config.path, planned);
			for (const target of planned) {
				if (!input.skipHosts) yield* HOST_CHECKS[target.target](target);
				validations.push({
					config: target.config,
					target: target.target,
					out: target.out,
					host: input.skipHosts ? "skipped" : "passed",
					notes: target.notes,
				});
			}
		}
		return validations;
	});
