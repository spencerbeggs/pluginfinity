import type { EnvConfig, HookEntry, Target } from "@pluginfinity/core";
import type { KnownTargetId } from "@pluginfinity/targets";
import type { EmittedFile } from "./emit.js";
import { ENV_LIB_FILES } from "./env-lib.generated.js";
import type { TargetHookEvent } from "./hooks.js";
import type { BuildNote } from "./notes.js";
import { CONFIG_NOTE_PATH } from "./notes.js";

/**
 * Seconds the env runner gives the `setup` script before it discards its
 * output and resolves without it.
 *
 * @public
 */
export const ENV_SETUP_TIMEOUT = 10;

/**
 * The host timeout, in seconds, of the generated SessionStart entry: the setup
 * bound plus room for the runner to write the values after a setup timeout.
 *
 * @public
 */
export const ENV_RUNNER_TIMEOUT = 15;

/** The env runner's file name beside `env.sh`. */
const RUNNER = "env-run.sh";

const BLOCK = /^(# >>> pluginfinity env declarations[^\n]*\n)[\s\S]*?^(# <<< pluginfinity env declarations)$/m;

const singleQuote = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

/**
 * `env.sh` with its declarations block filled in: the declared names in
 * config order, each default, the setup path and its time bound.
 *
 * @remarks
 * Every value is single-quoted for the shell. The names need no quoting: the
 * config schema admits only `[A-Z_][A-Z0-9_]*`.
 *
 * @public
 */
export const renderEnvLib = (env: EnvConfig): string => {
	const source = ENV_LIB_FILES.find((file) => file.name === "env.sh")?.content;
	if (source === undefined || !BLOCK.test(source)) throw new Error("env.sh has no declarations block");
	const names = Object.keys(env.vars);
	const declarations = [
		`_pf_env_names=${singleQuote(names.join(" "))}`,
		...names.map((name) => `_pf_env_default_${name}=${singleQuote(env.vars[name]?.default ?? "")}`),
		`_pf_env_setup=${singleQuote(env.setup ?? "")}`,
		`_pf_env_setup_timeout=${ENV_SETUP_TIMEOUT}`,
		"",
	].join("\n");
	return source.replace(BLOCK, (_match, begin: string, end: string) => `${begin}${declarations}${end}`);
};

/**
 * The session env library as a build writes it under `dir`: `env.sh` with its
 * declarations, and the SessionStart runner `env-run.sh`.
 *
 * @public
 */
export const envLibFiles = (env: EnvConfig, dir: string): ReadonlyArray<EmittedFile> =>
	ENV_LIB_FILES.map((file) => ({
		path: `${dir}/${file.name}`,
		content: file.name === "env.sh" ? renderEnvLib(env) : file.content,
	}));

/**
 * The hook entry that runs the env runner at `${PLUGIN_ROOT}/<dir>/env-run.sh`
 * under `sh`, with no matcher, so it runs for every SessionStart source.
 *
 * @public
 */
export const envRunnerEntry = (dir: string): HookEntry => ({
	command: `sh "\${PLUGIN_ROOT}/${dir}/${RUNNER}"`,
	timeout: ENV_RUNNER_TIMEOUT,
});

/**
 * The events with `entry` first among the SessionStart entries, adding the
 * event (first) when the plugin has no SessionStart hooks. A target without
 * SessionStart gets the events unchanged.
 *
 * @remarks
 * First in order is not first to finish: Claude Code runs an event's matching
 * hooks in parallel, so another SessionStart hook may read before the runner
 * has written the session values, and then resolves the chain live.
 *
 * @public
 */
export const withEnvRunner = (
	target: Target,
	events: ReadonlyArray<TargetHookEvent>,
	entry: HookEntry,
): ReadonlyArray<TargetHookEvent> => {
	const existing = events.find((event) => event.event === "SessionStart");
	if (existing !== undefined) {
		return events.map((event) => (event === existing ? { ...event, entries: [entry, ...event.entries] } : event));
	}
	const name = target.hooks.ownEvents.includes("SessionStart") ? "SessionStart" : target.hooks.events.SessionStart;
	if (typeof name !== "string") return events;
	return [{ event: "SessionStart", name, entries: [entry] }, ...events];
};

/**
 * The build notes for a target's session env: `env-shell-unsupported` when
 * the host cannot pass values from SessionStart to the model's shell, so a
 * skill script must source `env.sh` to see them.
 *
 * @public
 */
export const envNotes = (target: Target, id: KnownTargetId): ReadonlyArray<BuildNote> =>
	target.hooks.envShell.includes("SessionStart")
		? []
		: [{ target: id, path: CONFIG_NOTE_PATH, kind: "env-shell-unsupported", name: "env" }];

/**
 * Seconds a SessionStart reader may wait for the env runner (3) plus headroom;
 * a SessionStart hook with a smaller `timeout` can be killed while it waits.
 *
 * @public
 */
export const ENV_WAIT_TIMEOUT_FLOOR = 5;

/**
 * An `env-wait-timeout` note for each SessionStart entry (other than the
 * runner, which is added later) whose `timeout` is set and under
 * {@link ENV_WAIT_TIMEOUT_FLOOR}: its hook library waits up to 3 s for the
 * runner before it reads. The note's path is the entry's script, else `config`.
 *
 * @public
 */
export const envWaitNotes = (id: KnownTargetId, events: ReadonlyArray<TargetHookEvent>): ReadonlyArray<BuildNote> =>
	events
		.filter((event) => event.event === "SessionStart")
		.flatMap((event) => event.entries)
		.filter((entry) => entry.timeout !== undefined && entry.timeout < ENV_WAIT_TIMEOUT_FLOOR)
		.map((entry) => ({
			target: id,
			path: "script" in entry ? entry.script : CONFIG_NOTE_PATH,
			kind: "env-wait-timeout" as const,
			name: "SessionStart",
		}));
