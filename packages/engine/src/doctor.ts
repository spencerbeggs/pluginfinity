import type { ToolResolutionFailure } from "@effected/commands";
import { Tool, ToolDiscovery } from "@effected/commands";
import { CurrentDistribution, DistributionField, Remediation } from "@effected/engine";
import { SemVer } from "@effected/semver";
import { Walker } from "@effected/walker";
import type { KnownTargetId } from "@pluginfinity/targets";
import { TARGETS } from "@pluginfinity/targets";
import { Duration, Effect, FileSystem, Option, Path, Result, Schema } from "effect";
import type { ConfigError } from "./errors.js";
import type { LoadedConfig } from "./loader.js";
import { ConfigLoader } from "./loader.js";
import type { ConfigSelection } from "./selection.js";
import { selectConfigPaths } from "./selection.js";
import { ENGINE_VERSION } from "./version.js";

/**
 * The lowest Node.js version pluginfinity runs on: the `engines` floor.
 *
 * @public
 */
export const NODE_FLOOR = "24.11.0";

/**
 * How long one check may take before it is reported as timed out.
 *
 * @public
 */
export const DEFAULT_CHECK_TIMEOUT: Duration.Duration = Duration.seconds(10);

/**
 * Whether a check passed.
 *
 * @public
 */
export const CheckStatus = Schema.Literals(["pass", "fail"]);

/**
 * How much a failing check matters: `required` fails `doctor --strict`,
 * `warning` and `info` never do.
 *
 * @public
 */
export const CheckSeverity = Schema.Literals(["required", "warning", "info"]);

/**
 * The checklist section a check belongs to.
 *
 * @public
 */
export const CheckGroup = Schema.Literals(["runtime", "hosts", "tools", "config"]);

/**
 * One line of the doctor report.
 *
 * @public
 */
export class DoctorCheck extends Schema.Class<DoctorCheck>("DoctorCheck")({
	/** Stable id: `node`, `package-manager`, `claude`, `copilot`, `bats`, `git`, `config`. */
	id: Schema.String,
	group: CheckGroup,
	/** What was checked, for people: `node >= 24.11.0`, `claude`. */
	label: Schema.String,
	status: CheckStatus,
	severity: CheckSeverity,
	/** One line on what was found: `found 2.1.0`, `not found`. */
	detail: Schema.String,
	/** The version found, `null` when absent or unparseable. */
	version: Schema.NullOr(Schema.String),
	/** The config file or directory a config check is about, `null` otherwise. */
	path: Schema.NullOr(Schema.String),
	/** What to do about a failure, `null` on a pass. */
	remediation: Schema.NullOr(Remediation),
}) {}

/**
 * Everything `doctor` found, for a front end to render.
 *
 * @public
 */
export class DoctorReport extends Schema.Class<DoctorReport>("DoctorReport")({
	engineVersion: Schema.String,
	distribution: DistributionField,
	checks: Schema.Array(DoctorCheck),
}) {
	/** No required check failed. Warnings and information never count. */
	get ok(): boolean {
		return !this.checks.some((check) => check.severity === "required" && check.status === "fail");
	}
}

/**
 * The input to {@link runDoctor}.
 *
 * @public
 */
export interface DoctorInput {
	readonly selection: ConfigSelection;
	/** The running Node.js version without a leading `v`, read by the front end. */
	readonly nodeVersion: string;
	/** Per-check time limit; {@link DEFAULT_CHECK_TIMEOUT} when absent. */
	readonly timeout?: Duration.Duration | undefined;
}

type Severity = typeof CheckSeverity.Type;
type Group = typeof CheckGroup.Type;

const LOCKFILES: ReadonlyArray<readonly [file: string, manager: string]> = [
	["pnpm-lock.yaml", "pnpm"],
	["package-lock.json", "npm"],
	["yarn.lock", "yarn"],
	["bun.lock", "bun"],
	["bun.lockb", "bun"],
];

const check = (fields: {
	readonly id: string;
	readonly group: Group;
	readonly label: string;
	readonly severity: Severity;
	readonly detail: string;
	readonly pass: boolean;
	readonly version?: string | undefined;
	readonly path?: string | undefined;
	readonly remediation?: Remediation | undefined;
}): DoctorCheck =>
	DoctorCheck.make({
		id: fields.id,
		group: fields.group,
		label: fields.label,
		status: fields.pass ? "pass" : "fail",
		severity: fields.severity,
		detail: fields.detail,
		version: fields.version ?? null,
		path: fields.path ?? null,
		remediation: fields.pass ? null : (fields.remediation ?? null),
	});

const nodeCheck = (nodeVersion: string): Effect.Effect<DoctorCheck> =>
	Effect.gen(function* () {
		const base = { id: "node", group: "runtime", label: `node >= ${NODE_FLOOR}`, severity: "required" } as const;
		const remediation = { hint: `Install Node.js ${NODE_FLOOR} or later.` };
		const floor = yield* SemVer.parse(NODE_FLOOR).pipe(Effect.orDie);
		const parsed = yield* Effect.result(SemVer.parse(nodeVersion));
		if (Result.isFailure(parsed)) {
			return check({ ...base, pass: false, detail: `could not parse version "${nodeVersion}"`, remediation });
		}
		const pass = SemVer.gte(parsed.success, floor);
		return check({
			...base,
			pass,
			version: nodeVersion,
			detail: pass ? `found ${nodeVersion}` : `found ${nodeVersion}, below the floor`,
			remediation,
		});
	});

const describeFailure = (error: ToolResolutionFailure): string =>
	error._tag === "ToolNotFoundError" ? "not found" : error.message;

const toolCheck = (
	fields: { readonly id: string; readonly group: Group; readonly label: string; readonly severity: Severity },
	name: string,
	timeout: Duration.Duration,
): Effect.Effect<DoctorCheck, never, ToolDiscovery> =>
	Effect.gen(function* () {
		const discovery = yield* ToolDiscovery;
		const remediation = { hint: `Install ${fields.label} and make sure \`${name}\` is on PATH.` };
		const outcome = yield* discovery.resolve(Tool.named(name)).pipe(Effect.timeoutOption(timeout), Effect.result);
		if (Result.isFailure(outcome)) {
			return check({ ...fields, pass: false, detail: describeFailure(outcome.failure), remediation });
		}
		if (Option.isNone(outcome.success)) {
			return check({
				...fields,
				pass: false,
				detail: `\`${name} --version\` did not answer within ${Duration.format(timeout)}`,
				remediation: { hint: `Check that \`${name} --version\` runs on its own.` },
			});
		}
		const version = Option.getOrUndefined(outcome.success.value.version);
		return check({
			...fields,
			pass: true,
			version,
			detail: version === undefined ? "found (version unknown)" : `found ${version}`,
		});
	});

const detectPackageManager = (start: string): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const has = (file: string) => fs.exists(file).pipe(Effect.orElseSucceed(() => false));
		for (const dir of yield* Walker.ascend(start)) {
			for (const [file, manager] of LOCKFILES) {
				if (yield* has(path.join(dir, file))) return manager;
			}
			if (yield* has(path.join(dir, ".git"))) break;
		}
		// No lockfile: npm ships with Node, so it is the manager that is there.
		return "npm";
	});

const configFailure = (error: ConfigError): DoctorCheck =>
	check({
		id: "config",
		group: "config",
		label: "config",
		severity: "required",
		pass: false,
		detail: error.message,
		path: error.path,
		remediation: error.remediation,
	});

const configChecks = (
	selection: ConfigSelection,
	timeout: Duration.Duration,
): Effect.Effect<
	{ readonly checks: ReadonlyArray<DoctorCheck>; readonly loaded: ReadonlyArray<LoadedConfig> },
	never,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const selected = yield* Effect.result(selectConfigPaths(selection));
		if (Result.isFailure(selected)) {
			const error = selected.failure;
			// No config at all is information, not a failure: doctor runs anywhere.
			if (error._tag === "ConfigNotFound" && selection._tag !== "File") {
				return {
					checks: [
						check({
							id: "config",
							group: "config",
							label: "config",
							severity: "info",
							pass: false,
							detail: "no pluginfinity config found",
							path: error.path,
							remediation: error.remediation,
						}),
					],
					loaded: [],
				};
			}
			return { checks: [configFailure(error)], loaded: [] };
		}
		const checks: Array<DoctorCheck> = [];
		const loaded: Array<LoadedConfig> = [];
		for (const path of selected.success) {
			// A config can hang while importing (a top-level await that never
			// settles); the check gives up after the timeout like every other.
			const result = yield* Effect.result(ConfigLoader.load(path).pipe(Effect.timeoutOption(timeout)));
			if (Result.isFailure(result)) {
				checks.push(configFailure(result.failure));
			} else if (Option.isNone(result.success)) {
				checks.push(
					check({
						id: "config",
						group: "config",
						label: "config",
						severity: "required",
						pass: false,
						detail: `loading did not finish within ${Duration.format(timeout)}`,
						path,
						remediation: { hint: `Check ${path} for a top-level await that never settles.` },
					}),
				);
			} else {
				const config = result.success.value;
				loaded.push(config);
				checks.push(
					check({
						id: "config",
						group: "config",
						label: "config",
						severity: "required",
						pass: true,
						detail: `${config.config.name}: ${config.targets.join(", ")}`,
						path,
					}),
				);
			}
		}
		return { checks, loaded };
	});

const startOf = (selection: ConfigSelection, path: Path.Path): string =>
	selection._tag === "File" ? path.dirname(selection.path) : selection.start;

/**
 * Report on the environment: the runtime, each host CLI, the tools pluginfinity
 * uses, and the config. Never fails; every problem is a check in the report.
 *
 * @public
 */
export const runDoctor = (
	input: DoctorInput,
): Effect.Effect<DoctorReport, never, ToolDiscovery | FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const path = yield* Path.Path;
		const timeout = input.timeout ?? DEFAULT_CHECK_TIMEOUT;
		const config = yield* configChecks(input.selection, timeout);
		const targeted = new Set<KnownTargetId>(config.loaded.flatMap((loaded) => loaded.targets));
		const manager = yield* detectPackageManager(startOf(input.selection, path));

		const probes = yield* Effect.all(
			[
				nodeCheck(input.nodeVersion),
				toolCheck({ id: "package-manager", group: "runtime", label: manager, severity: "warning" }, manager, timeout),
				...TARGETS.map((target) =>
					toolCheck(
						{
							id: target.id,
							group: "hosts",
							label: target.id,
							severity: targeted.has(target.id) ? "required" : "info",
						},
						target.id,
						timeout,
					),
				),
				toolCheck({ id: "bats", group: "tools", label: "bats", severity: "warning" }, "bats", timeout),
				toolCheck({ id: "git", group: "tools", label: "git", severity: "warning" }, "git", timeout),
			],
			{ concurrency: "unbounded" },
		);

		const distribution = yield* CurrentDistribution;
		return DoctorReport.make({
			engineVersion: ENGINE_VERSION,
			distribution: Option.getOrNull(distribution),
			checks: [...probes, ...config.checks],
		});
	});
