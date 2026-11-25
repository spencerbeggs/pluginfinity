import { Schema } from "effect";
import type { ClaudeHookEvent } from "../hooks.js";
import {
	PermissionUpdate,
	additionalContext,
	anything,
	backgroundTasks,
	flag,
	input,
	mcpServer,
	num,
	oneOf,
	opt,
	output,
	record,
	sessionCrons,
	strings,
	text,
	toolInput,
	toolName,
	toolUseId,
} from "./build.js";

// Claude Code's hook events, each as the JSON it sends a hook and the JSON it
// reads back. Written from https://code.claude.com/docs/en/hooks.md as read on
// 2026-11-25; where that page is silent or contradicts itself the description
// says so and the shape stays loose.

const NOTHING_READ = "Claude Code reads no decision from this event; a hook here is for side effects.";

const sessionTitle = opt(
	text(
		"The session's custom title, present only when one was set (--name, /rename, a hook's sessionTitle or the Agent SDK). A generated title does not appear here.",
	),
);

const taskFields = {
	task_id: text("Identifier of the task."),
	task_subject: text("Title of the task."),
	task_description: opt(text("Detailed description of the task.")),
	teammate_name: opt(text("Name of the teammate acting on the task.")),
	team_name: opt(text("Deprecated: a session-derived team name that will be removed.")),
};

const stopFields = {
	stop_hook_active: flag(
		"true when Claude Code is already continuing because of a stop hook. Check it before blocking again; after eight continuations in a row Claude Code overrides the block.",
	),
	last_assistant_message: opt(
		text("The text of the final response. Use it instead of reading transcript_path, which can lag the turn."),
	),
	background_tasks: backgroundTasks,
	session_crons: sessionCrons,
};

const stopOutput = (event: "Stop" | "SubagentStop", who: string) =>
	output(event, `Decides whether ${who} stops. Exit code 2 blocks the stop too, with stderr as the reason.`, {
		block: {
			decision: `Prevents ${who} from stopping. Omit it to allow the stop.`,
			reason: `Required with decision: tells ${who} why to continue, as its next instruction.`,
		},
		specific: {
			additionalContext: additionalContext(
				`at the end of the turn. The conversation continues so ${who} can act on it, shown as hook feedback rather than a hook error, under the same loop protections as a block`,
			),
		},
	});

const modelFields = <const S extends ReadonlyArray<string>>(sources: S, sourceDescription: string) => ({
	from_model: text("Model ID the switch changes from."),
	to_model: text("Model ID the switch changes to. The matcher compares against this model's canonical name."),
	requested_model: Schema.NullOr(Schema.String).annotate({
		description:
			"The model the request named: an alias such as opus, a full model ID, or null for the default model or a change Claude Code made on its own.",
	}),
	source: oneOf(sources, sourceDescription),
	context_tokens: num("Tokens the next request re-sends as its prompt. 0 before the first response."),
	prompt_cache_warm: flag("Whether the current model's prompt cache is likely still warm, so the switch forfeits it."),
	cache_ttl: oneOf(["5m", "1h"], "Prompt cache lifetime of the main conversation at the time of the switch."),
	estimated_cache_write_usd: num(
		"Estimated cost in US dollars of writing context_tokens to the prompt cache on to_model. An estimate only.",
	),
	pricing: oneOf(
		["configured", "catalog", "default"],
		"How the estimate was priced: your organization's rates, list price, or an assumed default rate.",
	),
});

const elicitationOutput = (event: "Elicitation" | "ElicitationResult", accept: string) =>
	output(
		event,
		"Answers, changes, declines or cancels an MCP elicitation. Print nothing to leave it as it is. Exit code 2 declines, and a hookSpecificOutput without an action is ignored.",
		{
			discards: ["continue", "systemMessage"],
			block: {
				decision:
					"Declines, the same as action decline, and overrides an action in the same output. Read from Claude Code 2.1.284; ignored from 2.1.105 until then.",
				reason: "Accepted and discarded: neither the user nor the server sees it.",
			},
			specific: {
				action: oneOf(["accept", "decline", "cancel"], `accept ${accept}; decline and cancel send that to the server.`),
				content: opt(
					record(
						"With accept: the form field values, keyed by the property names of requested_schema. It replaces the whole content object.",
					),
				),
			},
		},
	);

/**
 * One event's input and output schemas.
 *
 * @public
 */
export interface HookIo {
	readonly input: Schema.Codec<unknown, unknown>;
	readonly output: Schema.Codec<unknown, unknown>;
}

/**
 * The input and output schema of every Claude Code hook event: the JSON a hook
 * receives and the JSON it may answer with.
 *
 * @public
 */
export const HOOK_IO: Readonly<Record<ClaudeHookEvent, HookIo>> = {
	SessionStart: {
		input: input(
			"SessionStart",
			"A session begins or resumes. Only command and mcp_tool hooks run here. CLAUDE_ENV_FILE is set: append export lines to carry variables into later Bash commands.",
			{
				source: oneOf(
					["startup", "resume", "clear", "compact", "fork"],
					"How the session started; the matcher filters on it. resume covers --resume, --continue and /resume; fork is a new session forked from an existing one.",
				),
				model: opt(text("The active model identifier. Often omitted, for example after /clear; check before reading.")),
				session_title: sessionTitle,
				seconds_since_last_response: opt(
					num(
						"Wall-clock seconds since the last response in the resumed transcript. Only on resume or fork. Claude Code 2.1.251 or later.",
					),
				),
				context_tokens: opt(num("Tokens the first request of the resumed session re-sends. Only on resume or fork.")),
				prompt_cache_likely_expired: opt(
					flag("true when the last response is older than the prompt cache lifetime. Only on resume or fork."),
				),
				estimated_cache_write_usd: opt(
					num("Estimated cost in US dollars of writing context_tokens to the prompt cache. Only on resume or fork."),
				),
			},
		),
		output: output(
			"SessionStart",
			"Adds context and sets up the session. Cannot block. Plain-text stdout is added to Claude's context too, so a hook that only adds context need not print JSON.",
			{
				specific: {
					additionalContext: additionalContext("at the start of the conversation, before the first prompt"),
					initialUserMessage: opt(
						text("Used as the first user message in non-interactive mode (-p), even when no prompt was passed."),
					),
					sessionTitle: opt(
						text(
							"Sets the session title, like /rename. Applies when source is startup, resume or fork. Check session_title first to avoid overwriting one.",
						),
					),
					watchPaths: opt(strings("Absolute paths to watch for FileChanged events during this session.")),
					reloadSkills: opt(
						flag(
							"true re-scans the skill and command directories after the SessionStart hooks, for skills a hook just installed.",
						),
					),
				},
			},
		),
	},
	Setup: {
		input: input(
			"Setup",
			"Claude Code was launched with --init-only, or with --init or --maintenance in -p mode. Only command hooks run here. CLAUDE_ENV_FILE is set.",
			{ trigger: oneOf(["init", "maintenance"], "Which flag triggered setup; the matcher filters on it.") },
		),
		output: output(
			"Setup",
			`${NOTHING_READ} Execution continues on any exit code, and hookSpecificOutput is discarded too.`,
			{
				discards: ["continue", "systemMessage"],
			},
		),
	},
	UserPromptSubmit: {
		input: input(
			"UserPromptSubmit",
			"A prompt was submitted, before Claude processes it. Also fires on turns Claude Code starts itself: a scheduled task, a background subagent reporting back, a message from another session. Default timeout 30 seconds. No matcher.",
			{
				prompt: text(
					"The submitted text. A typed skill or command arrives as typed, not expanded. Pasted content arrives expanded in place.",
				),
				session_title: sessionTitle,
			},
		),
		output: output(
			"UserPromptSubmit",
			"Adds context to a prompt or rejects it. Exit code 2 rejects it too, with stderr as the reason. Plain-text stdout is added to Claude's context.",
			{
				block: {
					decision: "Rejects the prompt. Omit it to let the prompt through.",
					reason: "Shown to the user, not added to context.",
				},
				specific: {
					additionalContext: additionalContext("alongside the submitted prompt"),
					sessionTitle: opt(text("Sets the session title, for naming a session from its prompt.")),
					suppressOriginalPrompt: opt(
						flag(
							"true leaves the prompt text out of the block message. The prompt can still appear in local transcript files.",
						),
					),
				},
			},
		),
	},
	UserPromptExpansion: {
		input: input(
			"UserPromptExpansion",
			"A command the user typed expands into a prompt, before it reaches Claude. This covers typing /skillname directly, which never fires PreToolUse. The matcher filters on command_name.",
			{
				expansion_type: oneOf(
					["slash_command", "mcp_prompt"],
					"slash_command for a skill or custom command, mcp_prompt for an MCP server prompt.",
				),
				command_name: text("The command's name, plugin-scoped for a plugin skill, such as my-plugin:example-skill."),
				command_args: text("The arguments typed after the command."),
				command_source: text("Where the command comes from, such as plugin."),
				prompt: text("The line as the user typed it."),
			},
		),
		output: output(
			"UserPromptExpansion",
			"Blocks the expansion or adds context. Exit code 2 blocks too, with stderr shown to the user.",
			{
				block: {
					decision: "Prevents the command from expanding. Omit it to allow it.",
					reason: "Shown to the user.",
				},
				specific: { additionalContext: additionalContext("alongside the expanded prompt") },
			},
		),
	},
	PreSkillShellCommand: {
		input: input(
			"PreSkillShellCommand",
			"A shell command a skill or command injects is about to run while it loads. PreToolUse does not fire for these. Claude Code 2.1.332 or later; an older version warns about an unknown event. Match Bash|PowerShell. prompt and agent hooks cannot run here and block every command they match.",
			{
				tool_name: oneOf(["Bash", "PowerShell"], "The tool that runs the command; the matcher filters on it."),
				tool_input: Schema.Struct({ command: text("The shell command as it would run.") }).annotate({
					description: "The command to run.",
				}),
				tool_use_id: text("ID of this command. It names no tool call in the transcript."),
				command_name: text("Name of the skill or command that is loading, such as pr-summary or my-plugin:deploy."),
				command_source: text(
					"Where it comes from, such as userSettings, projectSettings, policySettings, plugin or builtin.",
				),
				invoked_by: oneOf(
					["user", "claude", "other"],
					"user when the name was typed or sent by an SDK app, claude when Claude or a scheduled task invoked the skill, other otherwise.",
				),
			},
		),
		output: output(
			"PreSkillShellCommand",
			"Can only block the command; the skill still loads, with a note in place of the command's output. Exit code 2 blocks too. continue: false makes invoking the skill fail and none of its commands run.",
			{
				block: {
					decision: "Blocks the command.",
					reason: "The reason for the block.",
				},
				eventNames: ["PreToolUse", "PreSkillShellCommand"],
				specific: {
					permissionDecision: opt(
						oneOf(
							["allow", "deny", "ask", "defer"],
							"deny blocks the command. allow changes nothing: the command runs unless another hook blocks it. ask and defer are treated as deny.",
						),
					),
					permissionDecisionReason: opt(text("The reason for a block.")),
					updatedInput: opt(record("Not supported here: any updatedInput blocks the command, the same as deny.")),
				},
			},
		),
	},
	PreToolUse: {
		input: input(
			"PreToolUse",
			"Claude created a tool call, before it runs. The matcher filters on tool_name. Does not fire for a skill's injected shell commands (PreSkillShellCommand), for files referenced with @, or for EndConversation.",
			{
				tool_name: toolName,
				tool_input: toolInput,
				tool_use_id: toolUseId,
				mcp_server: mcpServer,
			},
		),
		output: output(
			"PreToolUse",
			"Allows, denies, asks about or defers the tool call, and can rewrite its input. Exit code 2 denies, with stderr shown to Claude. When hooks disagree, deny beats defer, which beats ask, which beats allow. Printing nothing leaves the call to the normal permission flow.",
			{
				specific: {
					permissionDecision: opt(
						oneOf(
							["allow", "deny", "ask", "defer"],
							"allow skips the permission prompt (deny and ask rules still apply); deny prevents the call; ask prompts the user; defer ends the turn so the call can resume later, in -p mode with a single tool call only.",
						),
					),
					permissionDecisionReason: opt(
						text(
							"For deny, shown to Claude. For ask, shown to the user in the prompt. For allow and defer, written to the debug log only.",
						),
					),
					updatedInput: opt(
						record(
							"Replaces the tool's whole input before it runs, so include the unchanged fields. Pair with allow to auto-approve or ask to show the user. Ignored with defer.",
						),
					),
					additionalContext: additionalContext("next to the tool result"),
				},
				extra: {
					decision: opt(
						oneOf(
							["approve", "block"],
							"Deprecated on this event: maps to allow and deny. Use hookSpecificOutput.permissionDecision.",
						),
					),
					reason: opt(text("Deprecated on this event. Use hookSpecificOutput.permissionDecisionReason.")),
				},
			},
		),
	},
	PermissionRequest: {
		input: input(
			"PermissionRequest",
			"Claude Code is about to ask the user for permission to use a tool. The matcher filters on tool_name. There is no tool_use_id. agent hooks are skipped on this event.",
			{
				tool_name: toolName,
				tool_input: toolInput,
				mcp_server: mcpServer,
				permission_suggestions: opt(
					Schema.Array(PermissionUpdate).annotate({
						description:
							"The permission updates Claude Code suggests, such as adding an allow rule. Not an exact list of the options the user sees. A hook may echo one back as updatedPermissions.",
					}),
				),
			},
		),
		output: output(
			"PermissionRequest",
			"Grants or denies the request on the user's behalf. Exit code 2 is not read as a decision here: return the decision object.",
			{
				specific: {
					decision: opt(
						Schema.Struct({
							behavior: oneOf(
								["allow", "deny"],
								"allow grants the permission, deny refuses it. A hook cannot approve what a deny rule refuses.",
							),
							updatedInput: opt(
								record(
									"allow only: replaces the tool's whole input. The result is checked against deny and ask rules again.",
								),
							),
							updatedPermissions: opt(
								Schema.Array(PermissionUpdate).annotate({
									description:
										"allow only: permission updates to apply, such as an allow rule so the user is not asked again.",
								}),
							),
							message: opt(text("deny only: tells Claude why the permission was denied.")),
							interrupt: opt(flag("deny only: true stops Claude.")),
						}).annotate({ description: "The decision." }),
					),
				},
			},
		),
	},
	PermissionDenied: {
		input: input(
			"PermissionDenied",
			"The auto mode classifier denied a tool call. Does not fire when the user denies a dialog, a PreToolUse hook blocks, or a deny rule matches. The matcher filters on tool_name.",
			{
				tool_name: toolName,
				tool_input: toolInput,
				tool_use_id: toolUseId,
				mcp_server: mcpServer,
				reason: text(
					"The denial reason: usually the matched policy in square brackets, or text saying the classifier produced no verdict.",
				),
			},
		),
		output: output(
			"PermissionDenied",
			"Can tell the model it may retry. The denial itself stands; the exit code and stderr are ignored.",
			{
				specific: {
					retry: opt(
						flag(
							"true adds a message telling the model it may retry the tool call. Ignored when the classifier produced no verdict.",
						),
					),
				},
			},
		),
	},
	PostToolUse: {
		input: input(
			"PostToolUse",
			"A tool call completed successfully. The matcher filters on tool_name. Does not fire when a Bash command or outside process rewrites a file; use FileChanged for that.",
			{
				tool_name: toolName,
				tool_input: toolInput,
				tool_response: anything(
					"The tool's result. A structured object whose shape depends on the tool (Write returns filePath and type; Bash returns stdout, stderr, interrupted and isImage); the error text as a string for a failed call.",
				),
				tool_use_id: toolUseId,
				duration_ms: opt(
					num("Tool execution time in milliseconds, excluding permission prompts and PreToolUse hooks."),
				),
				mcp_server: mcpServer,
			},
		),
		output: output(
			"PostToolUse",
			"Gives Claude feedback after a tool ran, or replaces what Claude sees of its output. The tool has already run. Exit code 2 shows stderr to Claude.",
			{
				block: {
					decision: "Adds the reason next to the tool result. Claude still sees the original output.",
					reason: "Shown to Claude.",
				},
				specific: {
					additionalContext: additionalContext("next to the tool result"),
					classifierContext: opt(
						text(
							"A short note about this result for the auto mode classifier, not for Claude. Capped at 2,000 characters per tool call. Do not copy untrusted tool output into it. Claude Code 2.1.236 or later.",
						),
					),
					updatedToolOutput: opt(
						anything(
							"Replaces the tool's output before Claude sees it. Must match the tool's output shape, or it is ignored for a built-in tool. Changes only what Claude sees.",
						),
					),
					updatedMCPToolOutput: opt(anything("Replaces the output for MCP tools only. Prefer updatedToolOutput.")),
				},
			},
		),
	},
	PostToolUseFailure: {
		input: input(
			"PostToolUseFailure",
			"A tool that started executing failed. Does not fire for a call rejected before it ran (unknown tool, invalid input, permission denial). The matcher filters on tool_name.",
			{
				tool_name: toolName,
				tool_input: toolInput,
				tool_use_id: toolUseId,
				mcp_server: mcpServer,
				error: text(
					"What went wrong, generally the text Claude receives. For Bash and PowerShell the first line is Exit code N. Treat the rest as display text, not a stable format.",
				),
				is_interrupt: opt(
					flag("true when the failure reached Claude Code as an abort rather than an error the tool reported."),
				),
				duration_ms: opt(num("Tool execution time in milliseconds.")),
			},
		),
		output: output(
			"PostToolUseFailure",
			"Adds context for Claude after a failure. Exit code 2 shows stderr to Claude. The docs disagree on blocking: their summary table lists this event under top-level decision, while this event's own section offers only additionalContext, so decision is modelled as optional and should not be relied on.",
			{
				block: {
					decision: "Listed in the docs' summary table only; not confirmed by this event's own section.",
					reason: "The reason, if decision is read at all.",
				},
				specific: { additionalContext: additionalContext("next to the error") },
			},
		),
	},
	PostToolBatch: {
		input: input(
			"PostToolBatch",
			"Every tool call in a batch of parallel calls has resolved, before the next model request. Fires once per batch. No matcher.",
			{
				tool_calls: Schema.Array(
					Schema.Struct({
						tool_name: toolName,
						tool_input: toolInput,
						tool_use_id: toolUseId,
						tool_response: anything(
							"What the model receives for this call: a serialized string or a content-block array, not the structured object PostToolUse gets.",
						),
					}),
				).annotate({ description: "Every tool call in the batch." }),
			},
		),
		output: output(
			"PostToolBatch",
			"Adds context once before the next model call, or stops the agentic loop. Exit code 2 stops it too, with stderr as the message.",
			{
				block: {
					decision: "Stops the agentic loop before the next model call.",
					reason: "Shown as a warning in the transcript, and it stays in the conversation.",
				},
				specific: { additionalContext: additionalContext("once, before the next model call") },
			},
		),
	},
	Notification: {
		input: input("Notification", "Claude Code sends a notification. The matcher filters on notification_type.", {
			message: text("The notification text."),
			title: opt(text("The notification title. For plugin_notification it is the mod's name unless the mod set one.")),
			notification_type: text(
				"Which notification fired, such as permission_prompt, idle_prompt, auth_success, auth_storage_failure, elicitation_dialog, elicitation_url_dialog, elicitation_complete, elicitation_response, agent_needs_input, agent_completed, quota_auto_resume_fired, quota_auto_resume_stale, quota_auto_resume_disabled or plugin_notification. The list grows between releases.",
			),
		}),
		output: output(
			"Notification",
			`${NOTHING_READ} The exit code and stderr are ignored; terminalSequence is still emitted.`,
			{
				discards: ["continue", "systemMessage"],
			},
		),
	},
	MessageDisplay: {
		input: input(
			"MessageDisplay",
			"Assistant message text is being displayed. Interactive runs call the hook once per batch of completed lines; -p and Agent SDK runs call it once per message. Default timeout 10 seconds; keep it fast. No matcher.",
			{
				turn_id: text("UUID of the current turn."),
				message_id: text("UUID of the message being displayed, stable across its batches. Not the API msg_ id."),
				index: num("Zero-based index of this batch within the message."),
				final: flag("true on the message's last batch. Use this, not a non-empty delta, as the end-of-message signal."),
				delta: text(
					"The newly completed lines since the prior batch, newlines included. The whole message in -p and SDK runs.",
				),
			},
		),
		output: output(
			"MessageDisplay",
			"Replaces what is shown on screen. Display only: the transcript and what Claude sees keep the original. If the hook fails or times out the original text is displayed.",
			{
				discards: ["continue", "systemMessage"],
				specific: { displayContent: opt(text("Text displayed in place of delta. Omit it to display the original.")) },
			},
		),
	},
	SubagentStart: {
		input: input(
			"SubagentStart",
			"Claude spawned or resumed a subagent, or an in-process teammate handles a new message. The matcher filters on agent_type; anchor a plugin-scoped name, as in ^my-plugin:reviewer$.",
			{
				agent_id: text("Unique identifier of the subagent."),
				agent_type: text(
					"The agent name: a built-in such as Explore, a custom agent's name, or a plugin-scoped my-plugin:reviewer.",
				),
			},
		),
		output: output(
			"SubagentStart",
			"Adds context to the subagent. Cannot block its creation; exit code 2 only shows stderr to the user.",
			{
				specific: {
					additionalContext: additionalContext("at the start of the subagent's conversation, before its first prompt"),
				},
			},
		),
	},
	SubagentStop: {
		input: input(
			"SubagentStop",
			"A subagent finished responding. Also fires for Claude Code's internal agents, where agent_type may be an empty string. The matcher filters on agent_type.",
			{
				...stopFields,
				agent_id: text("Unique identifier of the subagent."),
				agent_type: text("The agent name the matcher filters on. May be an empty string for an internal agent."),
				agent_transcript_path: text("The subagent's own transcript. transcript_path is the main session's."),
			},
		),
		output: stopOutput("SubagentStop", "the subagent"),
	},
	TaskCreated: {
		input: input("TaskCreated", "A task is being created with the TaskCreate tool. No matcher.", taskFields),
		output: output(
			"TaskCreated",
			"Can cancel the task. Exit code 2 cancels it too, with stderr returned to Claude as the tool's error. continue: false is ignored.",
			{
				discards: ["continue"],
				block: { decision: "Deletes the task.", reason: "Returned to Claude as the tool's error." },
			},
		),
	},
	TaskCompleted: {
		input: input(
			"TaskCompleted",
			"A task is being marked completed, through TaskUpdate or when a teammate finishes its turn with tasks in progress. No matcher.",
			taskFields,
		),
		output: output(
			"TaskCompleted",
			"Can keep the task open. Exit code 2 keeps it open too, with stderr fed back to the model. continue: false lets a teammate go idle with the task still in progress, and is ignored on a TaskUpdate call. onFailure has no effect on this event.",
			{ block: { decision: "Keeps the task open.", reason: "Given to Claude, which keeps working." } },
		),
	},
	Stop: {
		input: input(
			"Stop",
			"The main agent finished responding. Does not run after a user interrupt; an API error fires StopFailure instead. No matcher.",
			stopFields,
		),
		output: stopOutput("Stop", "Claude"),
	},
	StopFailure: {
		input: input(
			"StopFailure",
			"The turn ended because of an API error. Runs instead of Stop. The matcher filters on error.",
			{
				error: text(
					"The error type: rate_limit, authentication_failed, oauth_org_not_allowed, account_on_hold, billing_error, invalid_request, model_not_found, server_error (including HTTP 529), max_output_tokens, cloud_credential_error or unknown.",
				),
				error_details: opt(text("More detail about the error, when available.")),
				last_assistant_message: opt(
					text("The rendered error text shown in the conversation, not Claude's own output."),
				),
			},
		),
		output: output(
			"StopFailure",
			`${NOTHING_READ} The output and exit code are ignored, apart from terminalSequence.`,
			{
				discards: ["continue", "systemMessage"],
			},
		),
	},
	TeammateIdle: {
		input: input("TeammateIdle", "An agent team teammate is about to go idle after its turn. No matcher.", {
			teammate_name: text("Name of the teammate about to go idle."),
			team_name: opt(text("Deprecated: a session-derived team name that will be removed.")),
		}),
		output: output(
			"TeammateIdle",
			"Can keep the teammate working. Exit code 2 does too, with stderr as feedback. continue: false lets it go idle even if another hook blocks. onFailure has no effect on this event.",
			{ block: { decision: "Keeps the teammate working.", reason: "Given to the teammate." } },
		),
	},
	InstructionsLoaded: {
		input: input(
			"InstructionsLoaded",
			"A CLAUDE.md or .claude/rules/*.md file was loaded into context, at session start or lazily. Runs asynchronously. The matcher filters on load_reason.",
			{
				file_path: text("Absolute path of the instruction file that was loaded."),
				memory_type: oneOf(["User", "Project", "Local", "Managed"], "Scope of the file."),
				load_reason: oneOf(
					["session_start", "nested_traversal", "path_glob_match", "include", "compact"],
					"Why the file was loaded. compact fires when files are re-loaded after a compaction.",
				),
				globs: opt(strings("Path globs from the file's paths frontmatter. Only for path_glob_match loads.")),
				trigger_file_path: opt(text("The file whose access triggered a lazy load.")),
				parent_file_path: opt(text("The instruction file that included this one. Only for include loads.")),
			},
		),
		output: output("InstructionsLoaded", `${NOTHING_READ} It cannot block or change the load.`, {
			discards: ["continue", "systemMessage"],
		}),
	},
	ConfigChange: {
		input: input(
			"ConfigChange",
			"A settings, managed policy or skill file changed during the session. The matcher filters on source.",
			{
				source: oneOf(
					["user_settings", "project_settings", "local_settings", "policy_settings", "skills"],
					"Which kind of configuration changed.",
				),
				file_path: opt(text("Path of the file that changed.")),
			},
		),
		output: output(
			"ConfigChange",
			"Can stop the change from applying to the running session. Exit code 2 blocks it too. A policy_settings change cannot be blocked. A blocked change shows no message to the user or Claude.",
			{
				discards: ["continue", "systemMessage"],
				block: { decision: "Prevents the change from being applied.", reason: "Accepted but never shown." },
			},
		),
	},
	CwdChanged: {
		input: input(
			"CwdChanged",
			"A shell command in the main conversation changed the working directory. CLAUDE_ENV_FILE is set, and its variables are cleared at the next CwdChanged. No matcher.",
			{ old_cwd: text("The previous working directory."), new_cwd: text("The new working directory.") },
		),
		output: output(
			"CwdChanged",
			"Cannot block the change. systemMessage is shown as a brief terminal notification. The docs do not say where watchPaths sits in the output; it is modelled under hookSpecificOutput, as on SessionStart.",
			{
				discards: ["continue"],
				specific: {
					watchPaths: opt(
						strings(
							"Absolute paths. Replaces the dynamic FileChanged watch list; an empty array clears it. Paths from a matcher stay watched.",
						),
					),
				},
			},
		),
	},
	DirectoryAdded: {
		input: input(
			"DirectoryAdded",
			"A working directory was added mid-session. The add has already completed and the hook runs in the background. The matcher filters on source.",
			{
				directory: text("Absolute path of the directory that was added."),
				source: oneOf(
					["slash_command", "register_repo_root"],
					"slash_command for /add-dir, register_repo_root for the SDK control request.",
				),
			},
		),
		output: output(
			"DirectoryAdded",
			`${NOTHING_READ} systemMessage is not shown to the user here: for /add-dir it is given to Claude as context on the next turn, and for the SDK request it goes to the debug log.`,
			{ discards: ["continue"] },
		),
	},
	FileChanged: {
		input: input(
			"FileChanged",
			"A watched file changed on disk, whatever changed it. The matcher is split on | into literal filenames to watch, not treated as a regex. CLAUDE_ENV_FILE is set.",
			{
				file_path: text("Absolute path of the file that changed."),
				event: oneOf(["change", "add", "unlink"], "What happened: modified, created or deleted."),
			},
		),
		output: output(
			"FileChanged",
			"Cannot block the change. systemMessage is shown as a brief terminal notification. The docs do not say where watchPaths sits in the output; it is modelled under hookSpecificOutput, as on SessionStart.",
			{
				discards: ["continue"],
				specific: {
					watchPaths: opt(
						strings("Absolute paths. Replaces the dynamic watch list. Paths from a matcher stay watched."),
					),
				},
			},
		),
	},
	WorktreeCreate: {
		input: input(
			"WorktreeCreate",
			"Claude Code is creating a worktree. A hook here replaces the default git worktree behaviour entirely, and .worktreeinclude is not processed. No matcher.",
			{ name: text("A slug for the new worktree, user-specified or generated, such as bold-oak-a3f2.") },
		),
		output: output(
			"WorktreeCreate",
			"Returns the created worktree's path. A command hook does not print JSON: it prints the path as the last non-empty line of stdout, with everything else on stderr. Only an HTTP hook returns this object. Any non-zero exit, or no path, fails creation.",
			{
				discards: ["continue", "systemMessage"],
				specific: {
					worktreePath: opt(
						text(
							"HTTP hooks only: the absolute, normalized path of the created worktree, not passing through a symlink.",
						),
					),
				},
			},
		),
	},
	WorktreeRemove: {
		input: input("WorktreeRemove", "Claude Code is cleaning up a worktree a WorktreeCreate hook created. No matcher.", {
			worktree_path: text("Absolute path of the worktree being removed, as WorktreeCreate returned it."),
		}),
		output: output(
			"WorktreeRemove",
			"No decision is read from JSON. Only the exit code counts: non-zero fails the removal if the directory still exists afterwards.",
			{ discards: ["continue", "systemMessage"] },
		),
	},
	PreCompact: {
		input: input("PreCompact", "Claude Code is about to compact the conversation. The matcher filters on trigger.", {
			trigger: oneOf(["manual", "auto"], "manual for /compact, auto for automatic or idle compaction."),
			custom_instructions: Schema.NullOr(Schema.String).annotate({
				description: "What the user passed to /compact; null when they passed nothing, and always null for auto.",
			}),
		}),
		output: output(
			"PreCompact",
			"Can block compaction. Exit code 2 blocks it too. When the hook exits 0 without blocking, its plain stdout becomes instructions for the compaction summary.",
			{
				discards: ["continue", "systemMessage"],
				block: { decision: "Blocks compaction.", reason: "The reason; for a manual /compact it is shown to the user." },
			},
		),
	},
	PostCompact: {
		input: input("PostCompact", "A compaction completed. The matcher filters on trigger.", {
			trigger: oneOf(["manual", "auto"], "manual after /compact, auto after automatic or idle compaction."),
			compact_summary: text("The conversation summary the compaction generated."),
		}),
		output: output("PostCompact", NOTHING_READ, { discards: ["continue", "systemMessage"] }),
	},
	PreModelSwitch: {
		input: input(
			"PreModelSwitch",
			"A model switch the user or a client requested is about to apply. Claude Code 2.1.251 or later. The matcher compares against the canonical name of to_model; when none can be determined every hook runs, so check to_model too. Default timeout 30 seconds, and a timeout blocks the switch.",
			modelFields(
				["command", "picker", "sdk"],
				"Where the request came from: command for /model <name>, /config or fast mode; picker for a model picker; sdk for an Agent SDK host or Remote Control.",
			),
		),
		output: output(
			"PreModelSwitch",
			"Cancels the switch, asks the user to confirm it, or lets it proceed. Exit code 2 cancels it, with stderr shown to the user. When hooks disagree, deny beats ask, which beats allow. systemMessage is shown whatever the decision.",
			{
				block: { decision: "Cancels the switch.", reason: "The reason for cancelling." },
				specific: {
					permissionDecision: opt(
						oneOf(
							["allow", "deny", "ask"],
							"allow proceeds and skips Claude Code's own confirmation; deny cancels; ask prompts the user, and is treated as a refusal everywhere but /model in an interactive session. defer is not accepted.",
						),
					),
					permissionDecisionReason: opt(
						text("For deny, shown to the user. For ask, shown in the confirmation prompt. Ignored for allow."),
					),
				},
			},
		),
	},
	PostModelSwitch: {
		input: input(
			"PostModelSwitch",
			"The session's model changed, including changes Claude Code makes on its own. Claude Code 2.1.251 or later. The matcher compares against the canonical name of to_model. Default timeout 30 seconds.",
			modelFields(
				["command", "picker", "sdk", "auto", "resume"],
				"As on PreModelSwitch, plus auto for a fallback or other change Claude Code made itself and resume for the model restored on resume.",
			),
		),
		output: output(
			"PostModelSwitch",
			"Adds context for the new model. Cannot block: the model has already changed. Plain-text stdout is delivered as context too.",
			{ specific: { additionalContext: additionalContext("with the next request after the switch") } },
		),
	},
	Elicitation: {
		input: input(
			"Elicitation",
			"An MCP server requests user input during a tool call. The matcher filters on mcp_server_name.",
			{
				mcp_server_name: text("Name of the MCP server asking."),
				message: text("What the server is asking for."),
				mode: opt(oneOf(["form", "url"], "form for a form request, url for a browser-based one.")),
				url: opt(text("The URL to open. Only in url mode.")),
				elicitation_id: opt(text("Identifier of the request.")),
				requested_schema: opt(
					record("The JSON Schema of the form. Its property names are the keys an answer's content uses."),
				),
			},
		),
		output: elicitationOutput(
			"Elicitation",
			"answers for the user and skips the dialog (in url mode the URL never opens)",
		),
	},
	ElicitationResult: {
		input: input(
			"ElicitationResult",
			"The user responded to an MCP elicitation, before the response goes to the server. Does not run when an Elicitation hook answered. The matcher filters on mcp_server_name.",
			{
				mcp_server_name: text("Name of the MCP server."),
				action: oneOf(
					["accept", "decline", "cancel"],
					"What the user did. Check it is accept before returning accept, or a declined request becomes an accepted one.",
				),
				mode: opt(oneOf(["form", "url"], "The request's mode.")),
				elicitation_id: opt(text("Identifier of the request.")),
				content: opt(record("The values the user submitted.")),
			},
		),
		output: elicitationOutput("ElicitationResult", "sends your content in place of the user's values"),
	},
	SessionEnd: {
		input: input(
			"SessionEnd",
			"The session is ending. A plugin's SessionEnd hooks share a 1.5 second budget that a plugin entry's timeout does not raise. The matcher filters on reason.",
			{ reason: text("Why the session ended: clear, resume, logout, prompt_input_exit or other.") },
		),
		output: output("SessionEnd", `${NOTHING_READ} It cannot stop the session ending.`, {
			discards: ["continue", "systemMessage"],
		}),
	},
};
