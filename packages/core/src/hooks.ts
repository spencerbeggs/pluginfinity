import { Schema } from "effect";

/**
 * Every Claude Code hook event, the vocabulary a plugin's `hooks` config is
 * written in. Each target maps these to its own names.
 *
 * @public
 */
export const CLAUDE_HOOK_EVENTS = [
	"SessionStart",
	"Setup",
	"UserPromptSubmit",
	"UserPromptExpansion",
	"PreToolUse",
	"PermissionRequest",
	"PermissionDenied",
	"PostToolUse",
	"PostToolUseFailure",
	"PostToolBatch",
	"Notification",
	"MessageDisplay",
	"SubagentStart",
	"SubagentStop",
	"TaskCreated",
	"TaskCompleted",
	"Stop",
	"StopFailure",
	"TeammateIdle",
	"InstructionsLoaded",
	"ConfigChange",
	"CwdChanged",
	"DirectoryAdded",
	"FileChanged",
	"WorktreeCreate",
	"WorktreeRemove",
	"PreCompact",
	"PostCompact",
	"PreModelSwitch",
	"PostModelSwitch",
	"Elicitation",
	"ElicitationResult",
	"SessionEnd",
] as const;

/**
 * A Claude Code hook event name.
 *
 * @public
 */
export const ClaudeHookEvent = Schema.Literals(CLAUDE_HOOK_EVENTS);

/**
 * The decoded `ClaudeHookEvent`.
 *
 * @public
 */
export type ClaudeHookEvent = typeof ClaudeHookEvent.Type;

/**
 * What a target that lacks a hook's event does with it: fail the build, or
 * leave the hook out of that target.
 *
 * @public
 */
export const HookFallback = Schema.Literals(["fail", "omit"]);

/**
 * A path relative to the plugin root: no leading slash, no backslash, no `..`
 * segment.
 */
const PluginRelativePath = Schema.String.check(
	Schema.isPattern(/^(?![/\\])(?!(?:.*\/)?\.\.(?:\/|$))[^\\]+$/, {
		message: "must be a path relative to the plugin root, with no leading slash, backslash or .. segment",
	}),
);

const PositiveInt = Schema.Int.check(
	Schema.isGreaterThan(0, { message: "must be a positive whole number of seconds" }),
);

const sharedHookFields = {
	/** A Claude Code tool-name matcher, such as `Bash` or `Edit|Write`. */
	matcher: Schema.optionalKey(Schema.String),
	/** Seconds before the host gives up on the hook. */
	timeout: Schema.optionalKey(PositiveInt),
	/** What a target without this event does. Defaults to `"fail"`. */
	fallback: Schema.optionalKey(HookFallback),
};

/**
 * A hook that runs a script the plugin ships. The build checks the script
 * exists and writes each host's command for it.
 *
 * @public
 */
export const ScriptHook = Schema.Struct({
	script: PluginRelativePath,
	args: Schema.optionalKey(Schema.Array(Schema.String)),
	...sharedHookFields,
});

/**
 * A hook given as a command string. `${PLUGIN_ROOT}` is its one placeholder.
 *
 * @public
 */
export const CommandHook = Schema.Struct({
	command: Schema.String.check(Schema.isMinLength(1)),
	...sharedHookFields,
});

/**
 * One hook: exactly one of `script` or `command`. Decode strictly, or a mixed
 * entry decodes as whichever member matches first.
 *
 * @public
 */
export const HookEntry = Schema.Union([ScriptHook, CommandHook]);

/**
 * The decoded `HookEntry`.
 *
 * @public
 */
export type HookEntry = typeof HookEntry.Type;

/**
 * The hooks for one event. An empty list removes a base event's hooks when
 * used in a target override.
 *
 * @public
 */
export const HookEntries = Schema.Array(HookEntry);

/**
 * The fields of a hooks map over the events `E`, each optional.
 *
 * @public
 */
export type HooksFields<E extends ReadonlyArray<string>> = {
	readonly [K in E[number]]: Schema.optionalKey<typeof HookEntries>;
};

/**
 * A hooks map admitting exactly the events `E`, each optional.
 *
 * @remarks
 * Built as a `Struct` of optional keys because `Schema.Record` keyed by
 * literals makes every key required.
 *
 * @public
 */
export const makeHooks = <const E extends ReadonlyArray<string>>(events: E): Schema.Struct<HooksFields<E>> =>
	Schema.Struct(Object.fromEntries(events.map((event) => [event, Schema.optionalKey(HookEntries)])) as HooksFields<E>);

/**
 * A plugin's base `hooks` config, keyed by Claude Code event names.
 *
 * @public
 */
export const Hooks = makeHooks(CLAUDE_HOOK_EVENTS);
