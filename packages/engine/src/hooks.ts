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
 * name. An event the target lacks drops its `"omit"` entries and reports the
 * event when any entry would fail.
 *
 * @public
 */
export const targetHooks = (
	target: Target,
	id: KnownTargetId,
	config: PluginfinityConfig,
): { readonly events: ReadonlyArray<TargetHookEvent>; readonly unsupported: ReadonlyArray<UnsupportedHookEvent> } => {
	const setting = config[id];
	const override: Readonly<Record<string, ReadonlyArray<HookEntry> | undefined>> =
		typeof setting === "object" ? (setting.hooks ?? {}) : {};
	const merged: Record<string, ReadonlyArray<HookEntry> | undefined> = { ...config.hooks, ...override };
	const events: Array<TargetHookEvent> = [];
	const unsupported: Array<UnsupportedHookEvent> = [];
	for (const [event, entries] of Object.entries(merged)) {
		if (entries === undefined || entries.length === 0) continue;
		const mapped = target.hooks.ownEvents.includes(event) ? event : target.hooks.events[event];
		if (typeof mapped === "string") {
			events.push({ event, name: mapped, entries });
		} else if (entries.some((entry) => entry.fallback !== "omit")) {
			unsupported.push({ event });
		}
	}
	return { events, unsupported };
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
 * Every file the given events' `command` entries name as
 * `${PLUGIN_ROOT}/<path>`, so the build can ship and check them as it does
 * `script` paths.
 *
 * @public
 */
export const hookCommandFiles = (events: ReadonlyArray<TargetHookEvent>): ReadonlyArray<string> => [
	...new Set(
		events.flatMap((event) =>
			event.entries.flatMap((entry) =>
				"command" in entry ? [...entry.command.matchAll(COMMAND_FILE)].map((match) => match[1] ?? "") : [],
			),
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
 * The shell command a hook entry runs on a target: a `script` through `bash`
 * (or executed directly under `scripts.invoke: "exec"`) at the target's
 * plugin root, or a `command` with `${PLUGIN_ROOT}` spelled the target's way.
 *
 * @public
 */
export const hookCommand = (entry: HookEntry, root: string, invoke: "bash" | "exec"): string => {
	if ("command" in entry) return entry.command.replaceAll(PLUGIN_ROOT, root);
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
): { readonly command: string; readonly args: ReadonlyArray<string> } => {
	const path = `${root}/${entry.script}`;
	const args = [...(entry.args ?? [])];
	return invoke === "bash" ? { command: "bash", args: [path, ...args] } : { command: path, args };
};

type HooksRenderer = (
	events: ReadonlyArray<TargetHookEvent>,
	command: (entry: HookEntry) => string,
	exec: (entry: Extract<HookEntry, { readonly script: string }>) => { command: string; args: ReadonlyArray<string> },
) => unknown;

// One renderer per hooks format, total over HOOKS_FORMATS.
const FORMATS: Record<Target["hooks"]["format"], HooksRenderer> = {
	// Claude Code runs a script entry in exec form, with no shell; a command
	// entry stays the shell string its author wrote.
	"claude-hooks-json": (events, command, exec) => ({
		hooks: Object.fromEntries(
			events.map(({ name, entries }) => [
				name,
				entries.map((entry) => ({
					...(entry.matcher === undefined ? {} : { matcher: entry.matcher }),
					hooks: [
						{
							type: "command",
							...("script" in entry ? exec(entry) : { command: command(entry) }),
							...(entry.timeout === undefined ? {} : { timeout: entry.timeout }),
						},
					],
				})),
			]),
		),
	}),
	"copilot-hooks-v1": (events, command) => ({
		version: 1,
		hooks: Object.fromEntries(
			events.map(({ name, entries }) => [
				name,
				entries.map((entry) => ({
					type: "command",
					bash: command(entry),
					...(entry.matcher === undefined ? {} : { matcher: entry.matcher }),
					...(entry.timeout === undefined ? {} : { timeoutSec: entry.timeout }),
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
			(entry) => hookCommand(entry, root, invoke),
			(entry) => hookExec(entry, root, invoke),
		),
		null,
		"\t",
	)}\n`;
};
