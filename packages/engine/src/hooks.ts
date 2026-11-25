import type { HookEntry, HookHandler, Target } from "@pluginfinity/core";
import { hookHandler } from "@pluginfinity/core";
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
 * A hook entry whose handler kind the target cannot run, with `fallback`
 * `"fail"`, the default.
 *
 * @public
 */
export interface UnsupportedHookHandler {
	readonly event: string;
	readonly handler: HookHandler;
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
	/** Entries whose handler kind the target cannot run, and that do not set `fallback: "omit"`. */
	readonly unsupportedHandlers: ReadonlyArray<UnsupportedHookHandler>;
	/**
	 * Source event names the target lacks whose every entry sets `fallback: "omit"`, and, as
	 * `<Event> (<handler>)`, each entry left out because the target cannot run its handler kind.
	 */
	readonly omitted: ReadonlyArray<string>;
} => {
	const setting = config[id];
	const override: Readonly<Record<string, ReadonlyArray<HookEntry> | undefined>> =
		typeof setting === "object" ? (setting.hooks ?? {}) : {};
	const merged: Record<string, ReadonlyArray<HookEntry> | undefined> = { ...config.hooks, ...override };
	const events: Array<TargetHookEvent> = [];
	const unsupported: Array<UnsupportedHookEvent> = [];
	const omitted: Array<string> = [];
	const unsupportedHandlers: Array<UnsupportedHookHandler> = [];
	for (const [event, all] of Object.entries(merged)) {
		if (all === undefined || all.length === 0) continue;
		const mapped = target.hooks.ownEvents.includes(event) ? event : target.hooks.events[event];
		// On an event the target has, an entry it cannot run is left out or fails, by its own fallback.
		const entries =
			typeof mapped === "string"
				? all.filter((entry) => {
						const handler = hookHandler(entry);
						if (target.hooks.handlers.includes(handler)) return true;
						if (entry.fallback === "omit") omitted.push(`${event} (${handler})`);
						else unsupportedHandlers.push({ event, handler });
						return false;
					})
				: all;
		if (typeof mapped === "string") {
			if (entries.length > 0) events.push({ event, name: mapped, entries });
		} else if (entries.some((entry) => entry.fallback !== "omit")) {
			unsupported.push({ event });
		} else {
			omitted.push(event);
		}
	}
	return { events, unsupported, unsupportedHandlers, omitted };
};

/**
 * Every `script` path the given events run.
 *
 * @public
 */
export const hookScripts = (events: ReadonlyArray<TargetHookEvent>): ReadonlyArray<string> => [
	...new Set(events.flatMap((event) => event.entries.flatMap((entry) => ("script" in entry ? [entry.script] : [])))),
];

/**
 * Every `binary` path prefix the given events run.
 *
 * @public
 */
export const hookBinaries = (events: ReadonlyArray<TargetHookEvent>): ReadonlyArray<string> => [
	...new Set(events.flatMap((event) => event.entries.flatMap((entry) => ("binary" in entry ? [entry.binary] : [])))),
];

/**
 * The `sh -c` program a `binary` entry runs: `$0` is the binary's path prefix,
 * `$1` the plugin root (handed to the program as `PLUGINFINITY_ROOT`, where it
 * finds the facts the build wrote for it), and the file for this machine is
 * named after what `uname` prints. Under Git Bash on Windows the system reads
 * as `Windows` and the file ends in `.exe`. A machine
 * the plugin ships no binary for exits 0 with no output, so the hook fails
 * open there; on a `failClosed` entry it exits 1, which Claude Code blocks on
 * (`onFailure`) and Copilot reads as a deny on `preToolUse`. It holds no
 * single quote, so it can sit inside a pair.
 *
 * @public
 */
export const BINARY_DISPATCH =
	'r=$1; shift; s=$(uname -s); e=; case "$s" in MINGW*|MSYS*|CYGWIN*) s=Windows; e=.exe;; esac; b="$0-$s-$(uname -m)$e"; [ -x "$b" ] || exit "${PLUGINFINITY_FAIL_CLOSED:-0}"; PLUGINFINITY_ROOT="$r" exec "$b" "$@"';

// Claude Code ignores `onFailure` on these: a block there sends Claude back to
// work, and it cannot repair a hook that will not run.
const ON_FAILURE_INERT: ReadonlySet<string> = new Set(["Stop", "SubagentStop", "TaskCompleted", "TeammateIdle"]);

/**
 * Claude Code's `onFailure` for an entry: `{ onFailure: "block" }` when the
 * entry is `failClosed` and the event honours it, so a hook the host cannot
 * start, that times out or that prints unreadable output stops the action too.
 * The hook library covers a failure inside a running script; this covers the
 * ones no script can.
 *
 * @public
 */
export const onFailure = (event: string, entry: HookEntry): { readonly onFailure?: "block" } =>
	entry.failClosed === true &&
	!ON_FAILURE_INERT.has(event) &&
	!BACKGROUND(entry) &&
	READS_ON_FAILURE.has(hookHandler(entry))
		? { onFailure: "block" }
		: {};

// Claude Code reads `onFailure` on these handler kinds only.
const READS_ON_FAILURE: ReadonlySet<HookHandler> = new Set(["command", "http", "mcp_tool"]);

// A background hook cannot stop anything: the action has already gone ahead.
const BACKGROUND = (entry: HookEntry): boolean =>
	("async" in entry && entry.async === true) || ("asyncRewake" in entry && entry.asyncRewake === true);

/**
 * The events a hook's `if` condition is evaluated on. Elsewhere Claude Code
 * never runs a hook that sets one.
 *
 * @public
 */
export const IF_EVENTS: ReadonlyArray<string> = [
	"PreToolUse",
	"PostToolUse",
	"PostToolUseFailure",
	"PermissionRequest",
	"PermissionDenied",
	"PreSkillShellCommand",
];

// The events that run every handler kind, and the ones that run fewer.
const ALL_HANDLER_EVENTS: ReadonlySet<string> = new Set([
	"PermissionDenied",
	"PostToolBatch",
	"PostToolUse",
	"PostToolUseFailure",
	"PreToolUse",
	"Stop",
	"SubagentStop",
	"TaskCompleted",
	"TaskCreated",
	"TeammateIdle",
	"UserPromptExpansion",
	"UserPromptSubmit",
]);

/**
 * The handler kinds Claude Code runs on an event: all five on the events that
 * can ask a model, no `agent` on `PermissionRequest`, only `command` on
 * `Setup`, only `command` and `mcp_tool` on `SessionStart`, and no `prompt` or
 * `agent` anywhere else.
 *
 * @public
 */
export const eventHandlers = (event: string): ReadonlyArray<HookHandler> =>
	ALL_HANDLER_EVENTS.has(event)
		? ["command", "http", "mcp_tool", "prompt", "agent"]
		: event === "PermissionRequest"
			? ["command", "http", "mcp_tool", "prompt"]
			: event === "Setup"
				? ["command"]
				: event === "SessionStart"
					? ["command", "mcp_tool"]
					: ["command", "http", "mcp_tool"];

/**
 * One problem with a hook entry that no single field shows: a combination the
 * host would silently ignore or never run.
 *
 * @public
 */
export interface HookProblem {
	/** Where in the config: `hooks.<Event>[<index>]`. */
	readonly key: string;
	readonly message: string;
}

/**
 * The problems in one event's entries, in Claude Code's terms, which the
 * config is written in.
 *
 * @public
 */
export const hookProblems = (
	event: string,
	entries: ReadonlyArray<HookEntry>,
	prefix = "hooks",
): ReadonlyArray<HookProblem> =>
	entries.flatMap((entry, index) => {
		const key = `${prefix}.${event}[${index}]`;
		const handler = hookHandler(entry);
		const found: Array<HookProblem> = [];
		if (entry.if !== undefined && !IF_EVENTS.includes(event)) {
			found.push({
				key: `${key}.if`,
				message: `is only evaluated on ${IF_EVENTS.join(", ")}; on ${event} the hook would never run`,
			});
		}
		if (!eventHandlers(event).includes(handler)) {
			found.push({
				key,
				message: `is a ${handler} hook, and ${event} runs only ${eventHandlers(event).join(", ")} hooks`,
			});
		}
		if (entry.failClosed === true && BACKGROUND(entry)) {
			found.push({
				key: `${key}.failClosed`,
				message: "has no effect on a background hook, which cannot stop the action it follows",
			});
		}
		if (entry.failClosed === true && !READS_ON_FAILURE.has(handler)) {
			found.push({ key: `${key}.failClosed`, message: `has no effect on a ${handler} hook` });
		}
		return found;
	});

/**
 * What a `binary` entry is told beyond `entryEnv`: its host and the plugin's
 * name there. A script reads both from the `host.sh` the build writes beside
 * the hook library; a native program has only its environment.
 *
 * @public
 */
export interface HookFacts {
	readonly host: string;
	readonly plugin: string;
	/** The plugin's description, written at the top of a hooks file that has a place for it. */
	readonly description?: string;
	/** The plugin's own MCP servers on this target, which an `mcpTool` hook names with the plugin's scope. */
	readonly servers?: ReadonlySet<string>;
}

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

// Bare words pass through; anything else is single-quoted for bash. Not
// `ShellExports.quote`: it agrees except on control characters, which it
// writes as bash-only `$'…'`, and a monitor's shell is not measured.
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
export const entryEnv = (
	event: string,
	entry: HookEntry,
	matcher?: string,
	facts?: HookFacts,
): Readonly<Record<string, string>> => ({
	PLUGINFINITY_EVENT: event,
	...(entry.failClosed === true ? { PLUGINFINITY_FAIL_CLOSED: "1" } : {}),
	...(matcher === undefined ? {} : { PLUGINFINITY_MATCHER: matcher }),
	...("binary" in entry && facts !== undefined
		? { PLUGINFINITY_HOST: facts.host, PLUGINFINITY_PLUGIN: facts.plugin }
		: {}),
	// The libraries exit 0 whatever happens, so a hook may ask for exit 2 only where the build says it wakes the agent.
	...("asyncRewake" in entry && entry.asyncRewake === true ? { PLUGINFINITY_ASYNC_REWAKE: "1" } : {}),
});

// Env values in a shell string are always single-quoted (a decision:
// entry-facts-travel-as-env), so `ShellExports.quote`'s bare words do not fit.
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
 * plugin root, a `binary` through the platform dispatch, or a `command` with
 * `${PLUGIN_ROOT}` spelled the target's way.
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
	if (!("binary" in entry) && !("script" in entry)) {
		throw new Error(
			`a ${hookHandler(entry)} hook has no command; the build leaves it out of a target that runs commands only`,
		);
	}
	const file = "binary" in entry ? entry.binary : entry.script;
	const path = SAFE_PATH.test(file) ? `"${root}/${file}"` : `"${root}"/${shellQuote(file)}`;
	const args = (entry.args ?? []).map(shellQuote);
	if ("binary" in entry) return ["sh", "-c", `'${BINARY_DISPATCH}'`, path, `"${root}"`, ...args].join(" ");
	return [...(invoke === "bash" ? ["bash", path] : [path]), ...args].join(" ");
};

/**
 * A `script` or `binary` entry in exec form, for a host that spawns `command` with `args`
 * and no shell: `bash` with the script path as its first argument, or under
 * `scripts.invoke: "exec"` the script itself. The root placeholder is
 * substituted by the host in `args`, and no shell ever parses the path.
 *
 * @public
 */
export const hookExec = (
	entry: FileHookEntry,
	root: string,
	invoke: "bash" | "exec",
	env: Readonly<Record<string, string>> = {},
): { readonly command: string; readonly args: ReadonlyArray<string> } => {
	const args = [...(entry.args ?? [])];
	const pairs = Object.entries(env).map(([key, value]) => `${key}=${value}`);
	// A binary always goes through `sh`, which picks the file for the machine;
	// `env` stops reading assignments at `sh`, so "=" in the path is harmless.
	if ("binary" in entry) {
		const dispatch = ["sh", "-c", BINARY_DISPATCH, `${root}/${entry.binary}`, root, ...args];
		return pairs.length > 0
			? { command: "env", args: [...pairs, ...dispatch] }
			: { command: "sh", args: dispatch.slice(1) };
	}
	const path = `${root}/${entry.script}`;
	// The host spawns `env` directly, so `${CLAUDE_PLUGIN_ROOT}` in `args` is still
	// substituted by the host; see okf/references/claude-code-plugin-format.md
	// ("exec-form hook `args`").
	if (pairs.length > 0)
		return { command: "env", args: [...pairs, ...(invoke === "bash" ? ["bash"] : []), path, ...args] };
	return invoke === "bash" ? { command: "bash", args: [path, ...args] } : { command: path, args };
};

/**
 * A hook entry that names a file the plugin ships: a `script` or a `binary`.
 *
 * @public
 */
export type FileHookEntry = Extract<HookEntry, { readonly script: string } | { readonly binary: string }>;

type HooksRenderer = (
	events: ReadonlyArray<TargetHookEvent>,
	command: (entry: HookEntry, env?: Readonly<Record<string, string>>) => string,
	exec: (
		entry: FileHookEntry,
		env: Readonly<Record<string, string>>,
	) => { command: string; args: ReadonlyArray<string> },
	ignored: ReadonlyArray<string>,
	facts: HookFacts | undefined,
) => unknown;

// Mirrors the hook library: only [A-Za-z0-9_| ,-] is an exact `|` list.
const EXACT_LIST = /^[A-Za-z0-9_| ,-]*$/;

/**
 * Whether Claude Code reads a matcher as a regular expression: anything but
 * empty, `*`, or an exact list of letters, digits, `_`, `-`, spaces, `,` and `|`.
 *
 * @public
 */
export const isRegexMatcher = (matcher: string): boolean =>
	matcher !== "" && matcher !== "*" && !EXACT_LIST.test(matcher);

/**
 * How a host that ignores the SessionStart matcher is told a matcher: a host
 * names a fresh session's source `new` where Claude says `startup`, so a
 * matcher that matches `startup` must match `new` too.
 *
 * An exact list holding `startup` gains `new` right after it (`startup|resume`
 * becomes `startup|new|resume`, as does `startup, resume`); one that already holds `new`, an empty or `*`
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
		// Claude splits an exact list on `|` or `,` and ignores spaces around an item.
		const items = matcher.split(/[|,]/).map((item) => item.trim());
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

const present = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
	value === undefined ? {} : ({ [key]: value } as Record<K, V>);

// What a Claude Code handler object holds beyond its type and the fields every handler shares.
const claudeHandler = (
	event: string,
	entry: HookEntry,
	command: Parameters<HooksRenderer>[1],
	exec: Parameters<HooksRenderer>[2],
	ignored: ReadonlyArray<string>,
	facts: HookFacts | undefined,
): Record<string, unknown> => {
	if ("http" in entry) {
		return {
			type: "http",
			url: entry.http,
			...present("headers", entry.headers),
			...present("allowedEnvVars", entry.allowedEnvVars),
		};
	}
	if ("mcpTool" in entry) {
		// Claude Code names a plugin's own server plugin:<plugin>:<server>, never by its bare key.
		const own = facts?.servers?.has(entry.mcpTool.server) === true;
		return {
			type: "mcp_tool",
			server: own ? `plugin:${facts?.plugin ?? ""}:${entry.mcpTool.server}` : entry.mcpTool.server,
			tool: entry.mcpTool.tool,
			...present("input", entry.mcpTool.input),
		};
	}
	if ("prompt" in entry) {
		return {
			type: "prompt",
			prompt: entry.prompt,
			...present("model", entry.model),
			...present("continueOnBlock", entry.continueOnBlock),
		};
	}
	if ("agent" in entry) return { type: "agent", prompt: entry.agent, ...present("model", entry.model) };
	const env = entryEnv(event, entry, runtimeMatcher(ignored, event, entry), facts);
	return {
		type: "command",
		...("command" in entry ? { command: command(entry, env), ...present("shell", entry.shell) } : exec(entry, env)),
		...("async" in entry ? present("async", entry.async) : {}),
		...("asyncRewake" in entry ? present("asyncRewake", entry.asyncRewake) : {}),
	};
};

// One renderer per hooks format, total over HOOKS_FORMATS.
const FORMATS: Record<Target["hooks"]["format"], HooksRenderer> = {
	// Claude Code runs a script entry in exec form, with no shell; a command
	// entry stays the shell string its author wrote.
	"claude-hooks-json": (events, command, exec, ignored, facts) => ({
		...present("description", facts?.description),
		hooks: Object.fromEntries(
			events.map(({ event, name, entries }) => [
				name,
				entries.map((entry) => ({
					...(entry.matcher === undefined || ignored.includes(event) ? {} : { matcher: entry.matcher }),
					hooks: [
						{
							...claudeHandler(event, entry, command, exec, ignored, facts),
							...present("if", entry.if),
							...present("timeout", entry.timeout),
							...present("statusMessage", entry.statusMessage),
							...onFailure(event, entry),
						},
					],
				})),
			]),
		),
	}),
	// Copilot runs command entries only; the build has already left out or refused the rest.
	"copilot-hooks-v1": (events, command, _exec, ignored, facts) => ({
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
					env: entryEnv(event, entry, runtimeMatcher(ignored, event, entry), facts),
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
	facts?: HookFacts,
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
			facts,
		),
		null,
		"\t",
	)}\n`;
};
