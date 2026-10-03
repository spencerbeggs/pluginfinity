import { Run } from "@effected/commands";
import type { KnownTargetId } from "@pluginfinity/targets";
import { TARGETS } from "@pluginfinity/targets";
import type { PlatformError } from "effect";
import { Effect, FileSystem, Path, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { ChildProcess } from "effect/process";
import type { EmitPlan, EmittedFile } from "./emit.js";
import { applyEmit, planEmit } from "./emit.js";
import type { ConfigError } from "./errors.js";
import { BuildOutOfDate, HostRejected, PackageVersionMissing, TargetDrift } from "./errors.js";
import { renderManifest, serializeManifest } from "./manifest.js";
import type { ConfigSelection, PreparedPlugin } from "./selection.js";
import { preparePlugins } from "./selection.js";

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

/** Render every requested target of one plugin and compare each with its build directory. */
const planPlugin = (
	prepared: PreparedPlugin,
): Effect.Effect<
	ReadonlyArray<PlannedTarget>,
	PackageVersionMissing | PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const path = yield* Path.Path;
		const config = prepared.config;
		const version = yield* readVersion(config.root);
		const planned: Array<PlannedTarget> = [];
		for (const id of prepared.targets) {
			const target = targetOf(id);
			const manifest = renderManifest(target, id, config.config, version);
			const files: ReadonlyArray<EmittedFile> = [{ path: target.manifest.path, content: serializeManifest(manifest) }];
			const out = path.join(config.root, "builds", id);
			const plan = yield* planEmit(out, files);
			planned.push({ config: config.path, target: id, out, plan, files, name: String(manifest.name), version });
		}
		return planned;
	});

/** Fail with `BuildOutOfDate` when any target's build directory differs. */
const requireClean = (config: string, planned: ReadonlyArray<PlannedTarget>): Effect.Effect<void, BuildOutOfDate> => {
	const drift = planned
		.filter((target) => !target.plan.clean)
		.map(({ target, plan }) =>
			TargetDrift.make({ target, added: plan.added, changed: plan.changed, removed: plan.removed }),
		);
	return drift.length === 0 ? Effect.void : Effect.fail(new BuildOutOfDate({ path: config, targets: drift }));
};

/**
 * Regenerate `builds/<id>/` for every selected plugin and target, writing
 * only what differs. With `check`, write nothing and fail with
 * `BuildOutOfDate` when anything differs.
 *
 * @public
 */
export const build = (
	input: BuildInput,
): Effect.Effect<
	ReadonlyArray<TargetBuild>,
	ConfigError | PackageVersionMissing | BuildOutOfDate | PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
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
	ConfigError | PackageVersionMissing | BuildOutOfDate | HostRejected | PlatformError.PlatformError,
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
