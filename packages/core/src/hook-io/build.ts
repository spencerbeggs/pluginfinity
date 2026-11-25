import { Schema } from "effect";
import type { ClaudeHookEvent } from "../hooks.js";

// The small vocabulary every event shape is written in. Each helper attaches
// the description that ends up in the generated JSON Schema, so a field cannot
// be declared without one.

export const text = (description: string) => Schema.String.annotate({ description });
export const flag = (description: string) => Schema.Boolean.annotate({ description });
export const num = (description: string) => Schema.Finite.annotate({ description });
// Any JSON value. Not `Schema.Unknown`, whose description the JSON Schema output drops.
export const anything = (description: string) => Schema.Json.annotate({ description });
export const record = (description: string) => Schema.Record(Schema.String, Schema.Unknown).annotate({ description });
export const strings = (description: string) => Schema.Array(Schema.String).annotate({ description });
export const oneOf = <const L extends ReadonlyArray<string>>(values: L, description: string) =>
	Schema.Literals(values).annotate({ description });
export const opt = <S extends Schema.Top>(schema: S) => Schema.optionalKey(schema);

/** The permission modes Claude Code reports. Manual mode arrives as `default`. */
export const PERMISSION_MODES = ["default", "plan", "acceptEdits", "auto", "dontAsk", "bypassPermissions"] as const;

// The fields every event's input may carry.
const commonInput = {
	session_id: text("Current session identifier."),
	transcript_path: text(
		"Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.",
	),
	cwd: text(
		"Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.",
	),
	prompt_id: opt(
		text(
			"UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.",
		),
	),
	scratchpad_dir: opt(
		text(
			"Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.",
		),
	),
	permission_mode: opt(
		oneOf(
			PERMISSION_MODES,
			"Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.",
		),
	),
	effort: opt(
		Schema.Struct({
			level: oneOf(
				["low", "medium", "high", "xhigh", "max"],
				"The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.",
			),
		}).annotate({
			description: "Present on events with a tool-use context, on models that support effort.",
		}),
	),
	agent_id: opt(text("Unique identifier of the subagent or in-process teammate the hook fires in.")),
	agent_type: opt(
		text(
			"Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.",
		),
	),
};

/**
 * One event's input: the common fields, `hook_event_name` pinned to the
 * event, and the event's own fields. Unknown keys are allowed, since Claude
 * Code adds fields between releases.
 */
export const input = <F extends Schema.Struct.Fields>(event: ClaudeHookEvent, description: string, fields: F) =>
	Schema.Struct({
		...commonInput,
		hook_event_name: Schema.Literal(event).annotate({ description: `Always "${event}".` }),
		...fields,
	}).annotate({ title: `${event} hook input`, description });

const universal = {
	continue: opt(
		flag(
			"Default true. false stops Claude entirely after the hook runs, and beats an event-specific decision. It does not by itself block a PreToolUse tool call.",
		),
	),
	stopReason: opt(
		text("Shown to the user when continue is false. It stays in the conversation, so Claude sees it later."),
	),
	suppressOutput: opt(flag("Accepted and has no effect.")),
	systemMessage: opt(
		text(
			"A warning shown to the user, not added to Claude's context. Capped at 10,000 characters; longer text is saved to a file and replaced by its path and a 2,000 character preview.",
		),
	),
	terminalSequence: opt(
		text(
			"A terminal escape sequence Claude Code emits for the hook: only OSC 0, 1, 2, 9, 99, 777 and BEL. Anything else makes the field ignored. Interactive sessions only, and not from an async hook.",
		),
	),
};

type Universal = keyof typeof universal;

const blockFields = (decision: string, reason: string) => ({
	decision: opt(Schema.Literal("block").annotate({ description: decision })),
	reason: opt(text(reason)),
});

/** How an event's output differs from the universal fields. */
export interface OutputSpec {
	/** Universal fields this event discards; they are left out of the schema. */
	readonly discards?: ReadonlyArray<Universal>;
	/** The meaning of a top-level `decision: "block"` and its `reason`, when the event reads them. */
	readonly block?: { readonly decision: string; readonly reason: string };
	/** The event's `hookSpecificOutput` fields. */
	readonly specific?: Schema.Struct.Fields;
	/** The `hookEventName` values the host accepts, when not just the event's own name. */
	readonly eventNames?: ReadonlyArray<string>;
	/** Other top-level fields. */
	readonly extra?: Schema.Struct.Fields;
}

/**
 * One event's output: the JSON object a hook may print to stdout (or return as
 * an HTTP body) with exit code 0. A field the host discards on the event is
 * absent from the schema and named in the description.
 */
export const output = (
	event: ClaudeHookEvent,
	description: string,
	spec: OutputSpec = {},
): Schema.Codec<unknown, unknown> => {
	const discards = new Set<string>(spec.discards ?? []);
	if (discards.has("continue")) discards.add("stopReason");
	const kept = Object.fromEntries(Object.entries(universal).filter(([key]) => !discards.has(key)));
	const names = spec.eventNames ?? [event];
	const fields: Schema.Struct.Fields = {
		...kept,
		...(spec.block === undefined ? {} : blockFields(spec.block.decision, spec.block.reason)),
		...(spec.specific === undefined
			? {}
			: {
					hookSpecificOutput: opt(
						Schema.Struct({
							hookEventName: (names.length === 1 ? Schema.Literal(names[0] ?? event) : Schema.Literals(names)).annotate(
								{
									description: `Required whenever hookSpecificOutput is present: ${names.map((name) => `"${name}"`).join(" or ")}.`,
								},
							),
							...spec.specific,
						}).annotate({ description: `The ${event}-specific fields.` }),
					),
				}),
		...spec.extra,
	};
	const dropped = [...discards].filter((key) => key !== "suppressOutput");
	// The fields are assembled at run time, so the struct's static type says nothing useful;
	// every field is a plain JSON shape with no decoding services.
	return Schema.Struct(fields).annotate({
		title: `${event} hook output`,
		description:
			dropped.length === 0 ? description : `${description} Claude Code discards ${dropped.join(", ")} on this event.`,
	}) as unknown as Schema.Codec<unknown, unknown>;
};

/** `additionalContext`, with where the text lands on this event. */
export const additionalContext = (where: string) =>
	opt(
		text(
			`Text added to Claude's context ${where}, wrapped in a system reminder and not shown as a chat message. State facts rather than give commands. Capped at 10,000 characters.`,
		),
	);

// --- shapes several events share ---

export const toolName = text(
	"The tool being called: a built-in such as Bash, PowerShell, Edit, Write, Read, Glob, Grep, Agent, WebFetch or WebSearch, or an MCP tool named mcp__<server>__<tool> (mcp__plugin_<plugin>_<server>__<tool> for a plugin's own server).",
);

export const toolInput = record(
	"The arguments sent to the tool. The keys depend on the tool; see the tool-input schemas beside this file.",
);

export const toolUseId = text("Identifier of this tool call.");

export const mcpServer = opt(
	Schema.Struct({
		name: text("The MCP server's name."),
		source: text(
			"Where the server's definition came from, such as plugin, sdk, user or project. Base trust decisions on this, not on the name or the tool-name prefix.",
		),
	}).annotate({ description: "Present for an MCP tool only. Claude Code 2.1.274 or later." }),
);

const DESTINATIONS = ["session", "localSettings", "projectSettings", "userSettings"] as const;
const destination = oneOf(
	DESTINATIONS,
	"Where the change is written: session is in memory only; the others are .claude/settings.local.json, .claude/settings.json and ~/.claude/settings.json.",
);
const rules = Schema.Array(
	Schema.Struct({
		toolName: text("The tool the rule names, such as Bash or mcp__github__get_issue."),
		ruleContent: opt(
			text(
				"The rule's specifier, such as npm test for Bash(npm test). Omit it to match the whole tool; always omit it for an MCP tool.",
			),
		),
	}),
).annotate({ description: "The permission rules to add, replace or remove." });
const behavior = oneOf(["allow", "deny", "ask"], "The kind of rule.");

/** One permission update, as suggested to a PermissionRequest hook or returned by it. */
export const PermissionUpdate = Schema.Union([
	Schema.Struct({
		type: oneOf(
			["addRules", "replaceRules", "removeRules"],
			"addRules adds the rules; replaceRules replaces every rule of that behavior at the destination; removeRules removes the matching ones.",
		),
		rules,
		behavior,
		destination,
	}),
	Schema.Struct({
		type: Schema.Literal("setMode").annotate({ description: "Changes the permission mode." }),
		mode: oneOf(
			[...PERMISSION_MODES, "manual"],
			"The mode to switch to; manual is an alias for default. bypassPermissions only takes effect when the session was launched with bypass mode available.",
		),
		destination,
	}),
	Schema.Struct({
		type: oneOf(["addDirectories", "removeDirectories"], "Adds or removes working directories."),
		directories: strings("Directory paths."),
		destination,
	}),
]).annotate({ description: "A permission update entry; type decides its other fields." });

export const backgroundTasks = opt(
	Schema.Array(
		Schema.Struct({
			id: text("Task identifier."),
			type: text("A task-type label such as shell, subagent, monitor, workflow, teammate, cloud session or MCP task."),
			status: text("Current task status."),
			description: opt(text("Free-text description, capped at 1000 characters.")),
			command: opt(text("Shell command line. Only for shell tasks and monitor tasks that run a command.")),
			agent_type: opt(text("Subagent type name. Only for subagent tasks.")),
			server: opt(text("MCP server name. Only for monitor and MCP task tasks.")),
			tool: opt(text("MCP tool name. Only for monitor and MCP task tasks.")),
			name: opt(text("Workflow name. Only for workflow tasks.")),
		}),
	).annotate({
		description:
			"The session's in-flight background tasks; empty when nothing is running. With session_crons it tells a finished session from one paused waiting for background work.",
	}),
);

export const sessionCrons = opt(
	Schema.Array(
		Schema.Struct({
			id: text("Cron task identifier."),
			schedule: text("Cron expression, such as 0 9 * * 1-5."),
			recurring: flag("false for a one-shot wakeup, true for a task that fires on every match."),
			prompt: text("The prompt submitted when the cron fires, capped at 1000 characters."),
		}),
	).annotate({ description: "The session's scheduled wakeups, from CronCreate, ScheduleWakeup and /loop." }),
);
