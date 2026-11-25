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
	"PreSkillShellCommand",
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
 *
 * @public
 */
export const PluginRelativePath = Schema.String.check(
	// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are rejected on purpose
	Schema.isPattern(/^(?![/\\])(?!(?:[\s\S]*\/)?\.\.(?:\/|$))[^\\\u0000-\u001f]+$/, {
		message:
			"must be a path relative to the plugin root, with no leading slash, backslash, control character or .. segment",
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
	/** Deny or block when the script fails before answering. Defaults to failing open. */
	failClosed: Schema.optionalKey(Schema.Boolean),
	/**
	 * A Claude Code permission rule, such as `Bash(git *)` or `Edit(*.ts)`: the
	 * hook runs only for a tool call that matches, and no process is spawned
	 * otherwise. Tool events only. A host without it runs the hook on every
	 * matcher hit.
	 */
	if: Schema.optionalKey(Schema.String.check(Schema.isMinLength(1))),
	/** The spinner message shown while the hook runs, on a host that has one. */
	statusMessage: Schema.optionalKey(Schema.String),
};

// What only a hook that runs a program can do.
const programHookFields = {
	/** Run in the background without blocking. The hook can then decide nothing. */
	async: Schema.optionalKey(Schema.Boolean),
	/**
	 * Run in the background, and wake the agent when the hook asks to: a script
	 * calls `hook_rewake "<message>"`, a native hook `h.rewake(message)`.
	 */
	asyncRewake: Schema.optionalKey(Schema.Boolean),
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
	...programHookFields,
	...sharedHookFields,
});

/**
 * A hook given as a command string. `${PLUGIN_ROOT}` is its one placeholder.
 *
 * @public
 */
export const CommandHook = Schema.Struct({
	command: Schema.String.check(Schema.isMinLength(1)),
	/** The shell the command runs in, on a host that lets a hook choose. Defaults to the host's own. */
	shell: Schema.optionalKey(Schema.Literals(["bash", "powershell"])),
	...programHookFields,
	...sharedHookFields,
});

/**
 * A hook that runs a prebuilt native program, one file per platform. `binary`
 * is the path the files share: the build ships every `<binary>-<os>-<arch>`
 * the plugin holds, named as `uname -s` and `uname -m` print there (such as
 * `hooks/bin/guard-Darwin-arm64` and `hooks/bin/guard-Linux-x86_64`), and
 * writes each host a command that runs the one for the machine.
 *
 * @public
 */
export const BinaryHook = Schema.Struct({
	binary: PluginRelativePath,
	args: Schema.optionalKey(Schema.Array(Schema.String)),
	...programHookFields,
	...sharedHookFields,
});

/**
 * A hook that sends the event's JSON to a URL as an HTTP POST and reads the
 * response body as the hook's answer.
 *
 * @public
 */
export const HttpHook = Schema.Struct({
	http: Schema.String.check(Schema.isMinLength(1)),
	/** Extra request headers. A value may name an environment variable as `$NAME` or `${NAME}`. */
	headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
	/** The environment variables `headers` may interpolate. Any other reads as empty. */
	allowedEnvVars: Schema.optionalKey(Schema.Array(Schema.String)),
	...sharedHookFields,
});

/**
 * A hook that calls a tool on an MCP server and reads its text output as the
 * hook's answer. A `server` that names one of the plugin's own servers is
 * written with the plugin's scope.
 *
 * @public
 */
export const McpToolHook = Schema.Struct({
	mcpTool: Schema.Struct({
		server: Schema.String.check(Schema.isMinLength(1)),
		tool: Schema.String.check(Schema.isMinLength(1)),
		/** The tool's arguments. A string value may take a field of the event as `${tool_input.file_path}`. */
		input: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
	}),
	...sharedHookFields,
});

/**
 * A hook that asks a model one question and reads `{ok, reason}` back.
 * `$ARGUMENTS` in the prompt is the event's JSON.
 *
 * @public
 */
export const PromptHook = Schema.Struct({
	prompt: Schema.String.check(Schema.isMinLength(1)),
	model: Schema.optionalKey(Schema.String),
	/** Give a refusal's reason back to the agent and continue, instead of ending the turn. */
	continueOnBlock: Schema.optionalKey(Schema.Boolean),
	...sharedHookFields,
});

/**
 * A hook that runs a subagent with tool access to verify a condition; `agent`
 * is its prompt. Experimental on Claude Code.
 *
 * @public
 */
export const AgentHook = Schema.Struct({
	agent: Schema.String.check(Schema.isMinLength(1)),
	model: Schema.optionalKey(Schema.String),
	...sharedHookFields,
});

/**
 * One hook: exactly one of `script`, `command`, `binary`, `http`, `mcpTool`,
 * `prompt` or `agent`. Decode strictly, or a mixed entry decodes as whichever
 * member matches first.
 *
 * @public
 */
export const HookEntry = Schema.Union([
	ScriptHook,
	CommandHook,
	BinaryHook,
	HttpHook,
	McpToolHook,
	PromptHook,
	AgentHook,
]);

/**
 * The kinds of hook handler a host can run, in Claude Code's names. A
 * `script`, a `command` and a `binary` are all `command` handlers.
 *
 * @public
 */
export const HOOK_HANDLERS = ["command", "http", "mcp_tool", "prompt", "agent"] as const;

/**
 * A hook handler kind.
 *
 * @public
 */
export type HookHandler = (typeof HOOK_HANDLERS)[number];

/**
 * The handler kind an entry is.
 *
 * @public
 */
export const hookHandler = (entry: typeof HookEntry.Type): HookHandler =>
	"http" in entry
		? "http"
		: "mcpTool" in entry
			? "mcp_tool"
			: "prompt" in entry
				? "prompt"
				: "agent" in entry
					? "agent"
					: "command";

/**
 * The entry fields beyond the handler itself that only some hosts carry.
 *
 * @public
 */
export const HOOK_ENTRY_FIELDS = ["if", "statusMessage", "async", "asyncRewake", "shell"] as const;

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
