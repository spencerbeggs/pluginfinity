import { Run } from "@effected/commands";
import type { KnownTargetId } from "@pluginfinity/targets";
import { KNOWN_TARGET_IDS, TARGETS } from "@pluginfinity/targets";
import type { PlatformError } from "effect";
import { Effect, FileSystem, Path, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { ChildProcess } from "effect/process";
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
import { renderManifest, serializeManifest } from "./manifest.js";
import type { ConfigSelection, PreparedPlugin } from "./selection.js";
import { preparePlugins } from "./selection.js";
import { SERVER_LIB_DIR, serverLibFiles } from "./server-lib.js";
import { renderServers, serverFiles } from "./servers.js";
import { readSkills, renderSkill } from "./skills.js";
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

/** The files `entries` name: each file, or every file under each directory. */
const listedFiles = (
	config: LoadedConfig,
	entries: ReadonlyArray<string>,
): Effect.Effect<
	ReadonlyArray<string>,
	ShippedFileInvalid | PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = yield* fs.realPath(config.root);
		const out: Array<string> = [];
		for (const entry of entries) {
			const file = entry.replace(/\/+$/, "");
			const fail = (problem: ShippedFileInvalid["problem"]) =>
				Effect.fail(new ShippedFileInvalid({ path: config.path, file: entry, referencedBy: "files", problem }));
			const absolute = path.join(config.root, file);
			const info = yield* fs.stat(absolute).pipe(Effect.option);
			if (info._tag === "None") return yield* fail("missing");
			if (!isInside(root, yield* fs.realPath(absolute))) return yield* fail("outside-root");
			if (info.value.type === "Directory") out.push(...(yield* sourceFiles(config.root, file)));
			else out.push(file);
		}
		return out;
	});

/**
 * A `${PLUGIN_ROOT}`-relative path with its `.` and `..` segments resolved,
 * or `undefined` when it climbs out of the plugin root.
 */
const normalizeShipped = (file: string): string | undefined => {
	const segments: Array<string> = [];
	for (const segment of file.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			if (segments.pop() === undefined) return undefined;
		} else segments.push(segment);
	}
	return segments.join("/");
};

/**
 * The normalised path of a file a server names, failing with
 * `ShippedFileInvalid` unless it lies inside the plugin, exists as a file,
 * and (for a whole `command`) is executable.
 */
const checkServerFile = (
	config: LoadedConfig,
	file: string,
	referencedBy: string,
	command: boolean,
): Effect.Effect<string, ShippedFileInvalid | PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const fail = (problem: ShippedFileInvalid["problem"]) =>
			Effect.fail(new ShippedFileInvalid({ path: config.path, file, referencedBy, problem }));
		const normal = normalizeShipped(file);
		if (normal === undefined) return yield* fail("outside-root");
		const absolute = path.join(config.root, normal);
		const info = yield* fs.stat(absolute).pipe(Effect.option);
		if (info._tag === "None" || info.value.type !== "File") return yield* fail("missing");
		if (!isInside(yield* fs.realPath(config.root), yield* fs.realPath(absolute))) return yield* fail("outside-root");
		if (command && (info.value.mode & 0o111) === 0) return yield* fail("not-executable");
		return normal;
	});

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
 * `${PLUGIN_ROOT}/` (normalised, inside the plugin, and executable when a
 * whole `command`), and every file the `files` key lists, each once. A target
 * with a local server gets the server library under `lib/pluginfinity/`,
 * which is reserved the same way.
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
		const everyScript = new Set(hooks.flatMap(({ events }) => filesOf(events)));
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
		const collect = <A, R>(effect: Effect.Effect<A | undefined, ComponentInvalid | PlatformError.PlatformError, R>) =>
			effect.pipe(
				Effect.catchTag("ComponentInvalid", (error) =>
					// A problem that names no target recurs for every target; keep one.
					Effect.sync(() => {
						if (!failures.some((seen) => seen.message === error.message)) failures.push(error);
					}),
				),
			);

		const planned: Array<PlannedTarget> = [];
		for (const { id, target, events } of hooks) {
			const own = new Set(filesOf(events));
			const servers = serverFiles(target, id, config.config);
			const serverShipped: Array<string> = [];
			for (const [files, command] of [
				[servers.commands, true],
				[servers.others, false],
			] as const) {
				for (const file of files) {
					serverShipped.push(yield* checkServerFile(config, file, servers.owners.get(file) ?? "mcpServers", command));
				}
			}
			const shipped = [
				...new Set([
					...hooksDir.filter((file) => own.has(file) || !everyScript.has(file)),
					...[...own].filter((script) => !script.startsWith("hooks/")),
					...serverShipped,
					...listed,
				]),
			];
			const copied: Array<EmittedFile> = [];
			for (const file of shipped) copied.push(yield* copyFile(config.root, file));

			const manifest = renderManifest(target, id, config.config, version);
			const generated: Array<EmittedFile> = [{ path: target.manifest.path, content: serializeManifest(manifest) }];
			const hooksFile = renderHooks(target, events, invoke);
			if (hooksFile !== undefined) {
				generated.push({ path: target.hooks.path, content: hooksFile });
				generated.push(...hookLibFiles(id, String(manifest.name), ENGINE_VERSION));
			}
			const rendered = renderServers(target, id, config.config, String(manifest.name), SERVER_LIB_DIR);
			if (rendered.issues.length > 0) {
				const issue = new ComponentInvalid({ path: config.path, target: id, issues: rendered.issues });
				if (!failures.some((seen) => seen.message === issue.message)) failures.push(issue);
			}
			generated.push(...rendered.files);
			if (rendered.stdio) generated.push(...serverLibFiles());
			for (const skill of skills)
				generated.push(...((yield* collect(renderSkill(target, id, skill, KNOWN_TARGET_IDS))) ?? []));
			for (const agent of agents) {
				const file = yield* collect(renderAgent(target, id, agent, KNOWN_TARGET_IDS));
				if (file !== undefined) generated.push(file);
			}

			// The libraries' directories belong to pluginfinity; a source file there would shadow or join them.
			const reserved = copied.find((file) =>
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
			planned.push({ config: config.path, target: id, out, plan, files, name: String(manifest.name), version });
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
			for (const { config, target, out, plan } of planned) builds.push({ config, target, out, plan });
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
				});
			}
		}
		return validations;
	});
