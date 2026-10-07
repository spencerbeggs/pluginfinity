import type { HookEntry, Target } from "@pluginfinity/core";
import type { KnownTargetId, PluginfinityConfig } from "@pluginfinity/targets";

/**
 * One event's hooks as a target builds them: the source event name, the
 * target's name for it, and the entries.
 *
 * @public
 */
export interface TargetHookEvent {
	/** The event name as the config spells it. */
	readonly event: string;
	/** The target's name for the event. */
	readonly name: string;
	readonly entries: ReadonlyArray<HookEntry>;
}

/**
 * Why a target cannot build an event's hooks: the target lacks the event and
 * an entry's `fallback` is `"fail"`, the default.
 *
 * @public
 */
export interface UnsupportedHookEvent {
	readonly event: string;
}

/**
 * The hooks a target builds, before rendering: the base `hooks` with the
 * target's per-event overrides applied (an override replaces the base entries
 * for its event, and `[]` removes them), each event resolved to the target's
 * name. An event the target lacks is omitted, and listed in `omitted`, when
 * every entry sets `fallback: "omit"`; when any entry would fail, the event
 * is reported in `unsupported`.
 *
 * @public
 */
export const targetHooks = (
	target: Target,
	id: KnownTargetId,
	config: PluginfinityConfig,
): {
	readonly events: ReadonlyArray<TargetHookEvent>;
	readonly unsupported: ReadonlyArray<UnsupportedHookEvent>;
	/** Source event names the target lacks whose every entry sets `fallback: "omit"`. */
	readonly omitted: ReadonlyArray<string>;
} => {
	const setting = config[id];
	const override: Readonly<Record<string, ReadonlyArray<HookEntry> | undefined>> =
		typeof setting === "object" ? (setting.hooks ?? {}) : {};
	const merged: Record<string, ReadonlyArray<HookEntry> | undefined> = { ...config.hooks, ...override };
	const events: Array<TargetHookEvent> = [];
	const unsupported: Array<UnsupportedHookEvent> = [];
	const omitted: Array<string> = [];
	for (const [event, entries] of Object.entries(merged)) {
		if (entries === undefined || entries.length === 0) continue;
		const mapped = target.hooks.ownEvents.includes(event) ? event : target.hooks.events[event];
		if (typeof mapped === "string") {
			events.push({ event, name: mapped, entries });
		} else if (entries.some((entry) => entry.fallback !== "omit")) {
			unsupported.push({ event });
		} else {
			omitted.push(event);
		}
	}
	return { events, unsupported, omitted };
};

/**
 * Every `script` path the given events run.
 *
 * @public
 */
export const hookScripts = (events: ReadonlyArray<TargetHookEvent>): ReadonlyArray<string> => [
	...new Set(events.flatMap((event) => event.entries.flatMap((entry) => ("script" in entry ? [entry.script] : [])))),
];

// A path a command names after the root placeholder: up to the first
// character that ends a shell word or a quoted string.
const COMMAND_FILE = /\$\{PLUGIN_ROOT\}\/([^\s"'`;|&<>()$]+)/g;

/**
 * Every file a command names as `${PLUGIN_ROOT}/<path>`, in order.
 *
 * @public
 */
export const commandFiles = (command: string): ReadonlyArray<string> =>
	[...command.matchAll(COMMAND_FILE)].map((match) => match[1] ?? "");

/**
 * Every file the given events' `command` entries name as
 * `${PLUGIN_ROOT}/<path>`, so the build can ship and check them as it does
 * `script` paths.
 *
 * @public
 */
export const hookCommandFiles = (events: ReadonlyArray<TargetHookEvent>): ReadonlyArray<string> => [
	...new Set(
		events.flatMap((event) =>
			event.entries.flatMap((entry) => ("command" in entry ? commandFiles(entry.command) : [])),
		),
	),
];

// Bare words pass through; anything else is single-quoted for bash.
const shellQuote = (word: string): string =>
	/^[A-Za-z0-9_\-./=:@%+,]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;

const PLUGIN_ROOT = `\${PLUGIN_ROOT}`;

// Path characters that mean nothing to bash inside double quotes.
const SAFE_PATH = /^[A-Za-z0-9_\-./@%+,=:]+$/;

/**
 * The environment every hook entry runs with: the event the library reads
 * (camelCase Copilot payloads carry no `hook_event_name`), `"1"` for
 * `PLUGINFINITY_FAIL_CLOSED` when the entry sets `failClosed`, and the
 * matcher when one is given.
 *
 * @public
 */
export const entryEnv = (event: string, entry: HookEntry, matcher?: string): Readonly<Record<string, string>> => ({
	PLUGINFINITY_EVENT: event,
	...(entry.failClosed === true ? { PLUGINFINITY_FAIL_CLOSED: "1" } : {}),
	...(matcher === undefined ? {} : { PLUGINFINITY_MATCHER: matcher }),
});

// Env values in a shell string are always single-quoted.
const quoteValue = (value: string): string => `'${value.replaceAll("'", `'\\''`)}'`;

/**
 * An env as a shell prefix, `K='V' ` per pair: every value single-quoted, and
 * empty for an empty env.
 *
 * @public
 */
export const shellEnvPrefix = (env: Readonly<Record<string, string>>): string =>
	Object.entries(env)
		.map(([key, value]) => `${key}=${quoteValue(value)} `)
		.join("");

/**
 * The shell command a hook entry runs on a target: a `script` through `bash`
 * (or executed directly under `scripts.invoke: "exec"`) at the target's
 * plugin root, or a `command` with `${PLUGIN_ROOT}` spelled the target's way.
 *
 * @public
 */
export const hookCommand = (
	entry: HookEntry,
	root: string,
	invoke: "bash" | "exec",
	env: Readonly<Record<string, string>> = {},
): string => {
	const pairs = Object.entries(env).map(([key, value]) => `${key}=${quoteValue(value)}`);
	if ("command" in entry) {
		const command = entry.command.replaceAll(PLUGIN_ROOT, root);
		return pairs.length === 0 ? command : `${pairs.map((pair) => `export ${pair};`).join(" ")} ${command}`;
	}
	// The root stays in double quotes so the host's variable expands; a path
	// with characters the shell would read ($, `, ", spaces) is single-quoted.
	const path = SAFE_PATH.test(entry.script) ? `"${root}/${entry.script}"` : `"${root}"/${shellQuote(entry.script)}`;
	const args = (entry.args ?? []).map(shellQuote);
	return [...(invoke === "bash" ? ["bash", path] : [path]), ...args].join(" ");
};

/**
 * A `script` entry in exec form, for a host that spawns `command` with `args`
 * and no shell: `bash` with the script path as its first argument, or under
 * `scripts.invoke: "exec"` the script itself. The root placeholder is
 * substituted by the host in `args`, and no shell ever parses the path.
 *
 * @public
 */
export const hookExec = (
	entry: Extract<HookEntry, { readonly script: string }>,
	root: string,
	invoke: "bash" | "exec",
	env: Readonly<Record<string, string>> = {},
): { readonly command: string; readonly args: ReadonlyArray<string> } => {
	const path = `${root}/${entry.script}`;
	const args = [...(entry.args ?? [])];
	const pairs = Object.entries(env).map(([key, value]) => `${key}=${value}`);
	// The host spawns `env` directly, so `${CLAUDE_PLUGIN_ROOT}` in `args` is still
	// substituted by the host; see okf/references/claude-code-plugin-format.md
	// ("exec-form hook `args`").
	if (pairs.length > 0)
		return { command: "env", args: [...pairs, ...(invoke === "bash" ? ["bash"] : []), path, ...args] };
	return invoke === "bash" ? { command: "bash", args: [path, ...args] } : { command: path, args };
};

type HooksRenderer = (
	events: ReadonlyArray<TargetHookEvent>,
	command: (entry: HookEntry, env?: Readonly<Record<string, string>>) => string,
	exec: (
		entry: Extract<HookEntry, { readonly script: string }>,
		env: Readonly<Record<string, string>>,
	) => { command: string; args: ReadonlyArray<string> },
	ignored: ReadonlyArray<string>,
) => unknown;

// Mirrors the hook library: only [A-Za-z0-9_| ,-] is an exact `|` list.
const EXACT_LIST = /^[A-Za-z0-9_| ,-]*$/;

/**
 * How a host that ignores the SessionStart matcher is told a matcher: a host
 * names a fresh session's source `new` where Claude says `startup`, so a
 * matcher that matches `startup` must match `new` too.
 *
 * An exact list holding `startup` gains `new` right after it (`startup|resume`
 * becomes `startup|new|resume`); one that already holds `new`, an empty or `*`
 * matcher and any matcher not matching `startup` stay as written. A regex
 * that matches `startup` but not `new` also stays as written, reported as
 * `unwidened` so the build can note it. The regex is tried as a JavaScript
 * `RegExp` while the hook library matches with `grep -E`, so exotic syntax
 * may differ.
 *
 * @public
 */
export const sessionStartMatcher = (
	matcher: string,
): { readonly matcher: string; readonly widened: boolean; readonly unwidened: boolean } => {
	const same = { matcher, widened: false, unwidened: false };
	if (matcher === "" || matcher === "*") return same;
	if (EXACT_LIST.test(matcher)) {
		const items = matcher.split("|");
		const at = items.indexOf("startup");
		if (at === -1 || items.includes("new")) return same;
		items.splice(at + 1, 0, "new");
		return { matcher: items.join("|"), widened: true, unwidened: false };
	}
	try {
		const regex = new RegExp(matcher);
		return { ...same, unwidened: regex.test("startup") && !regex.test("new") };
	} catch {
		return same;
	}
};

/**
 * Whether a host that ignores matchers on `event` (`ignored` is its list) is
 * given a widened SessionStart matcher.
 *
 * @public
 */
export const widensSessionStart = (ignored: ReadonlyArray<string>, event: string): boolean =>
	event === "SessionStart" && ignored.includes(event);

// An entry's matcher runs in the hook library, not the host, on an event the host ignores matchers for.
const runtimeMatcher = (ignored: ReadonlyArray<string>, event: string, entry: HookEntry): string | undefined =>
	ignored.includes(event)
		? entry.matcher !== undefined && widensSessionStart(ignored, event)
			? sessionStartMatcher(entry.matcher).matcher
			: entry.matcher
		: undefined;

// One renderer per hooks format, total over HOOKS_FORMATS.
const FORMATS: Record<Target["hooks"]["format"], HooksRenderer> = {
	// Claude Code runs a script entry in exec form, with no shell; a command
	// entry stays the shell string its author wrote.
	"claude-hooks-json": (events, command, exec, ignored) => ({
		hooks: Object.fromEntries(
			events.map(({ event, name, entries }) => [
				name,
				entries.map((entry) => ({
					...(entry.matcher === undefined || ignored.includes(event) ? {} : { matcher: entry.matcher }),
					hooks: [
						{
							type: "command",
							...("script" in entry
								? exec(entry, entryEnv(event, entry, runtimeMatcher(ignored, event, entry)))
								: { command: command(entry, entryEnv(event, entry, runtimeMatcher(ignored, event, entry))) }),
							...(entry.timeout === undefined ? {} : { timeout: entry.timeout }),
						},
					],
				})),
			]),
		),
	}),
	"copilot-hooks-v1": (events, command, _exec, ignored) => ({
		version: 1,
		hooks: Object.fromEntries(
			events.map(({ event, name, entries }) => [
				name,
				entries.map((entry) => ({
					type: "command",
					bash: command(entry),
					...(entry.matcher === undefined || ignored.includes(event) ? {} : { matcher: entry.matcher }),
					...(entry.timeout === undefined ? {} : { timeoutSec: entry.timeout }),
					// Copilot gets the env only here, never as a shell prefix on `bash`.
					env: entryEnv(event, entry, runtimeMatcher(ignored, event, entry)),
				})),
			]),
		),
	}),
};

/**
 * Render a target's hooks file as JSON text, or `undefined` when the target
 * builds no hooks.
 *
 * @public
 */
export const renderHooks = (
	target: Target,
	events: ReadonlyArray<TargetHookEvent>,
	invoke: "bash" | "exec",
): string | undefined => {
	if (events.length === 0) return undefined;
	const root = target.pluginRoot.hooks;
	if (typeof root !== "string") {
		throw new Error(`target has no plugin-root spelling for hook commands: ${root.note}`);
	}
	return `${JSON.stringify(
		FORMATS[target.hooks.format](
			events,
			(entry, env) => hookCommand(entry, root, invoke, env),
			(entry, env) => hookExec(entry, root, invoke, env),
			target.hooks.matcherIgnored,
		),
		null,
		"\t",
	)}\n`;
};
