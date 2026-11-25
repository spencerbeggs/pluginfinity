//! Generated from the hook event schemas in @pluginfinity/core. Do not edit:
//! run `pnpm --filter @pluginfinity/core run hook-io:zig`.
//!
//! One struct per Claude Code hook event, as `Hook.as` reads it. The fields every
//! event may carry are optional, since a host other than Claude Code sends fewer;
//! an event's own fields are required where Claude Code always sends them. A
//! field whose values are a documented set is text, so a value added later still
//! parses, and a free-form field is a `std.json.Value`.

const std = @import("std");

/// A session begins or resumes. Only command and mcp_tool hooks run here. CLAUDE_ENV_FILE is set: append export lines to carry variables into later Bash commands.
pub const SessionStart = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "SessionStart".
    hook_event_name: []const u8,
    /// How the session started; the matcher filters on it. resume covers --resume, --continue and /resume; fork is a new session forked from an existing one.
    source: []const u8,
    /// The active model identifier. Often omitted, for example after /clear; check before reading.
    model: ?[]const u8 = null,
    /// The session's custom title, present only when one was set (--name, /rename, a hook's sessionTitle or the Agent SDK). A generated title does not appear here.
    session_title: ?[]const u8 = null,
    /// Wall-clock seconds since the last response in the resumed transcript. Only on resume or fork. Claude Code 2.1.251 or later.
    seconds_since_last_response: ?f64 = null,
    /// Tokens the first request of the resumed session re-sends. Only on resume or fork.
    context_tokens: ?f64 = null,
    /// true when the last response is older than the prompt cache lifetime. Only on resume or fork.
    prompt_cache_likely_expired: ?bool = null,
    /// Estimated cost in US dollars of writing context_tokens to the prompt cache. Only on resume or fork.
    estimated_cache_write_usd: ?f64 = null,
};

/// Claude Code was launched with --init-only, or with --init or --maintenance in -p mode. Only command hooks run here. CLAUDE_ENV_FILE is set.
pub const Setup = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "Setup".
    hook_event_name: []const u8,
    /// Which flag triggered setup; the matcher filters on it.
    trigger: []const u8,
};

/// A prompt was submitted, before Claude processes it. Also fires on turns Claude Code starts itself: a scheduled task, a background subagent reporting back, a message from another session. Default timeout 30 seconds. No matcher.
pub const UserPromptSubmit = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "UserPromptSubmit".
    hook_event_name: []const u8,
    /// The submitted text. A typed skill or command arrives as typed, not expanded. Pasted content arrives expanded in place.
    prompt: []const u8,
    /// The session's custom title, present only when one was set (--name, /rename, a hook's sessionTitle or the Agent SDK). A generated title does not appear here.
    session_title: ?[]const u8 = null,
};

/// A command the user typed expands into a prompt, before it reaches Claude. This covers typing /skillname directly, which never fires PreToolUse. The matcher filters on command_name.
pub const UserPromptExpansion = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "UserPromptExpansion".
    hook_event_name: []const u8,
    /// slash_command for a skill or custom command, mcp_prompt for an MCP server prompt.
    expansion_type: []const u8,
    /// The command's name, plugin-scoped for a plugin skill, such as my-plugin:example-skill.
    command_name: []const u8,
    /// The arguments typed after the command.
    command_args: []const u8,
    /// Where the command comes from, such as plugin.
    command_source: []const u8,
    /// The line as the user typed it.
    prompt: []const u8,
};

/// A shell command a skill or command injects is about to run while it loads. PreToolUse does not fire for these. Claude Code 2.1.332 or later; an older version warns about an unknown event. Match Bash|PowerShell. prompt and agent hooks cannot run here and block every command they match.
pub const PreSkillShellCommand = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PreSkillShellCommand".
    hook_event_name: []const u8,
    /// The tool that runs the command; the matcher filters on it.
    tool_name: []const u8,
    /// The command to run.
    tool_input: struct {
        /// The shell command as it would run.
        command: []const u8,
    },
    /// ID of this command. It names no tool call in the transcript.
    tool_use_id: []const u8,
    /// Name of the skill or command that is loading, such as pr-summary or my-plugin:deploy.
    command_name: []const u8,
    /// Where it comes from, such as userSettings, projectSettings, policySettings, plugin or builtin.
    command_source: []const u8,
    /// user when the name was typed or sent by an SDK app, claude when Claude or a scheduled task invoked the skill, other otherwise.
    invoked_by: []const u8,
};

/// Claude created a tool call, before it runs. The matcher filters on tool_name. Does not fire for a skill's injected shell commands (PreSkillShellCommand), for files referenced with @, or for EndConversation.
pub const PreToolUse = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PreToolUse".
    hook_event_name: []const u8,
    /// The tool being called: a built-in such as Bash, PowerShell, Edit, Write, Read, Glob, Grep, Agent, WebFetch or WebSearch, or an MCP tool named mcp__<server>__<tool> (mcp__plugin_<plugin>_<server>__<tool> for a plugin's own server).
    tool_name: []const u8,
    /// The arguments sent to the tool. The keys depend on the tool; see the tool-input schemas beside this file.
    tool_input: std.json.Value,
    /// Identifier of this tool call.
    tool_use_id: []const u8,
    /// Present for an MCP tool only. Claude Code 2.1.274 or later.
    mcp_server: ?struct {
        /// The MCP server's name.
        name: []const u8,
        /// Where the server's definition came from, such as plugin, sdk, user or project. Base trust decisions on this, not on the name or the tool-name prefix.
        source: []const u8,
    } = null,
};

/// Claude Code is about to ask the user for permission to use a tool. The matcher filters on tool_name. There is no tool_use_id. agent hooks are skipped on this event.
pub const PermissionRequest = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PermissionRequest".
    hook_event_name: []const u8,
    /// The tool being called: a built-in such as Bash, PowerShell, Edit, Write, Read, Glob, Grep, Agent, WebFetch or WebSearch, or an MCP tool named mcp__<server>__<tool> (mcp__plugin_<plugin>_<server>__<tool> for a plugin's own server).
    tool_name: []const u8,
    /// The arguments sent to the tool. The keys depend on the tool; see the tool-input schemas beside this file.
    tool_input: std.json.Value,
    /// Present for an MCP tool only. Claude Code 2.1.274 or later.
    mcp_server: ?struct {
        /// The MCP server's name.
        name: []const u8,
        /// Where the server's definition came from, such as plugin, sdk, user or project. Base trust decisions on this, not on the name or the tool-name prefix.
        source: []const u8,
    } = null,
    /// The permission updates Claude Code suggests, such as adding an allow rule. Not an exact list of the options the user sees. A hook may echo one back as updatedPermissions.
    permission_suggestions: ?[]const std.json.Value = null,
};

/// The auto mode classifier denied a tool call. Does not fire when the user denies a dialog, a PreToolUse hook blocks, or a deny rule matches. The matcher filters on tool_name.
pub const PermissionDenied = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PermissionDenied".
    hook_event_name: []const u8,
    /// The tool being called: a built-in such as Bash, PowerShell, Edit, Write, Read, Glob, Grep, Agent, WebFetch or WebSearch, or an MCP tool named mcp__<server>__<tool> (mcp__plugin_<plugin>_<server>__<tool> for a plugin's own server).
    tool_name: []const u8,
    /// The arguments sent to the tool. The keys depend on the tool; see the tool-input schemas beside this file.
    tool_input: std.json.Value,
    /// Identifier of this tool call.
    tool_use_id: []const u8,
    /// Present for an MCP tool only. Claude Code 2.1.274 or later.
    mcp_server: ?struct {
        /// The MCP server's name.
        name: []const u8,
        /// Where the server's definition came from, such as plugin, sdk, user or project. Base trust decisions on this, not on the name or the tool-name prefix.
        source: []const u8,
    } = null,
    /// The denial reason: usually the matched policy in square brackets, or text saying the classifier produced no verdict.
    reason: []const u8,
};

/// A tool call completed successfully. The matcher filters on tool_name. Does not fire when a Bash command or outside process rewrites a file; use FileChanged for that.
pub const PostToolUse = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PostToolUse".
    hook_event_name: []const u8,
    /// The tool being called: a built-in such as Bash, PowerShell, Edit, Write, Read, Glob, Grep, Agent, WebFetch or WebSearch, or an MCP tool named mcp__<server>__<tool> (mcp__plugin_<plugin>_<server>__<tool> for a plugin's own server).
    tool_name: []const u8,
    /// The arguments sent to the tool. The keys depend on the tool; see the tool-input schemas beside this file.
    tool_input: std.json.Value,
    /// The tool's result. A structured object whose shape depends on the tool (Write returns filePath and type; Bash returns stdout, stderr, interrupted and isImage); the error text as a string for a failed call.
    tool_response: std.json.Value,
    /// Identifier of this tool call.
    tool_use_id: []const u8,
    /// Tool execution time in milliseconds, excluding permission prompts and PreToolUse hooks.
    duration_ms: ?f64 = null,
    /// Present for an MCP tool only. Claude Code 2.1.274 or later.
    mcp_server: ?struct {
        /// The MCP server's name.
        name: []const u8,
        /// Where the server's definition came from, such as plugin, sdk, user or project. Base trust decisions on this, not on the name or the tool-name prefix.
        source: []const u8,
    } = null,
};

/// A tool that started executing failed. Does not fire for a call rejected before it ran (unknown tool, invalid input, permission denial). The matcher filters on tool_name.
pub const PostToolUseFailure = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PostToolUseFailure".
    hook_event_name: []const u8,
    /// The tool being called: a built-in such as Bash, PowerShell, Edit, Write, Read, Glob, Grep, Agent, WebFetch or WebSearch, or an MCP tool named mcp__<server>__<tool> (mcp__plugin_<plugin>_<server>__<tool> for a plugin's own server).
    tool_name: []const u8,
    /// The arguments sent to the tool. The keys depend on the tool; see the tool-input schemas beside this file.
    tool_input: std.json.Value,
    /// Identifier of this tool call.
    tool_use_id: []const u8,
    /// Present for an MCP tool only. Claude Code 2.1.274 or later.
    mcp_server: ?struct {
        /// The MCP server's name.
        name: []const u8,
        /// Where the server's definition came from, such as plugin, sdk, user or project. Base trust decisions on this, not on the name or the tool-name prefix.
        source: []const u8,
    } = null,
    /// What went wrong, generally the text Claude receives. For Bash and PowerShell the first line is Exit code N. Treat the rest as display text, not a stable format.
    @"error": []const u8,
    /// true when the failure reached Claude Code as an abort rather than an error the tool reported.
    is_interrupt: ?bool = null,
    /// Tool execution time in milliseconds.
    duration_ms: ?f64 = null,
};

/// Every tool call in a batch of parallel calls has resolved, before the next model request. Fires once per batch. No matcher.
pub const PostToolBatch = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PostToolBatch".
    hook_event_name: []const u8,
    /// Every tool call in the batch.
    tool_calls: []const struct {
        /// The tool being called: a built-in such as Bash, PowerShell, Edit, Write, Read, Glob, Grep, Agent, WebFetch or WebSearch, or an MCP tool named mcp__<server>__<tool> (mcp__plugin_<plugin>_<server>__<tool> for a plugin's own server).
        tool_name: []const u8,
        /// The arguments sent to the tool. The keys depend on the tool; see the tool-input schemas beside this file.
        tool_input: std.json.Value,
        /// Identifier of this tool call.
        tool_use_id: []const u8,
        /// What the model receives for this call: a serialized string or a content-block array, not the structured object PostToolUse gets.
        tool_response: std.json.Value,
    },
};

/// Claude Code sends a notification. The matcher filters on notification_type.
pub const Notification = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "Notification".
    hook_event_name: []const u8,
    /// The notification text.
    message: []const u8,
    /// The notification title. For plugin_notification it is the mod's name unless the mod set one.
    title: ?[]const u8 = null,
    /// Which notification fired, such as permission_prompt, idle_prompt, auth_success, auth_storage_failure, elicitation_dialog, elicitation_url_dialog, elicitation_complete, elicitation_response, agent_needs_input, agent_completed, quota_auto_resume_fired, quota_auto_resume_stale, quota_auto_resume_disabled or plugin_notification. The list grows between releases.
    notification_type: []const u8,
};

/// Assistant message text is being displayed. Interactive runs call the hook once per batch of completed lines; -p and Agent SDK runs call it once per message. Default timeout 10 seconds; keep it fast. No matcher.
pub const MessageDisplay = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "MessageDisplay".
    hook_event_name: []const u8,
    /// UUID of the current turn.
    turn_id: []const u8,
    /// UUID of the message being displayed, stable across its batches. Not the API msg_ id.
    message_id: []const u8,
    /// Zero-based index of this batch within the message.
    index: f64,
    /// true on the message's last batch. Use this, not a non-empty delta, as the end-of-message signal.
    final: bool,
    /// The newly completed lines since the prior batch, newlines included. The whole message in -p and SDK runs.
    delta: []const u8,
};

/// Claude spawned or resumed a subagent, or an in-process teammate handles a new message. The matcher filters on agent_type; anchor a plugin-scoped name, as in ^my-plugin:reviewer$.
pub const SubagentStart = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent.
    agent_id: ?[]const u8 = null,
    /// The agent name: a built-in such as Explore, a custom agent's name, or a plugin-scoped my-plugin:reviewer.
    agent_type: ?[]const u8 = null,
    /// Always "SubagentStart".
    hook_event_name: []const u8,
};

/// A subagent finished responding. Also fires for Claude Code's internal agents, where agent_type may be an empty string. The matcher filters on agent_type.
pub const SubagentStop = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent.
    agent_id: ?[]const u8 = null,
    /// The agent name the matcher filters on. May be an empty string for an internal agent.
    agent_type: ?[]const u8 = null,
    /// Always "SubagentStop".
    hook_event_name: []const u8,
    /// true when Claude Code is already continuing because of a stop hook. Check it before blocking again; after eight continuations in a row Claude Code overrides the block.
    stop_hook_active: bool,
    /// The text of the final response. Use it instead of reading transcript_path, which can lag the turn.
    last_assistant_message: ?[]const u8 = null,
    /// The session's in-flight background tasks; empty when nothing is running. With session_crons it tells a finished session from one paused waiting for background work.
    background_tasks: ?[]const struct {
        /// Task identifier.
        id: []const u8,
        /// A task-type label such as shell, subagent, monitor, workflow, teammate, cloud session or MCP task.
        type: []const u8,
        /// Current task status.
        status: []const u8,
        /// Free-text description, capped at 1000 characters.
        description: ?[]const u8 = null,
        /// Shell command line. Only for shell tasks and monitor tasks that run a command.
        command: ?[]const u8 = null,
        /// Subagent type name. Only for subagent tasks.
        agent_type: ?[]const u8 = null,
        /// MCP server name. Only for monitor and MCP task tasks.
        server: ?[]const u8 = null,
        /// MCP tool name. Only for monitor and MCP task tasks.
        tool: ?[]const u8 = null,
        /// Workflow name. Only for workflow tasks.
        name: ?[]const u8 = null,
    } = null,
    /// The session's scheduled wakeups, from CronCreate, ScheduleWakeup and /loop.
    session_crons: ?[]const struct {
        /// Cron task identifier.
        id: []const u8,
        /// Cron expression, such as 0 9 * * 1-5.
        schedule: []const u8,
        /// false for a one-shot wakeup, true for a task that fires on every match.
        recurring: bool,
        /// The prompt submitted when the cron fires, capped at 1000 characters.
        prompt: []const u8,
    } = null,
    /// The subagent's own transcript. transcript_path is the main session's.
    agent_transcript_path: []const u8,
};

/// A task is being created with the TaskCreate tool. No matcher.
pub const TaskCreated = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "TaskCreated".
    hook_event_name: []const u8,
    /// Identifier of the task.
    task_id: []const u8,
    /// Title of the task.
    task_subject: []const u8,
    /// Detailed description of the task.
    task_description: ?[]const u8 = null,
    /// Name of the teammate acting on the task.
    teammate_name: ?[]const u8 = null,
    /// Deprecated: a session-derived team name that will be removed.
    team_name: ?[]const u8 = null,
};

/// A task is being marked completed, through TaskUpdate or when a teammate finishes its turn with tasks in progress. No matcher.
pub const TaskCompleted = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "TaskCompleted".
    hook_event_name: []const u8,
    /// Identifier of the task.
    task_id: []const u8,
    /// Title of the task.
    task_subject: []const u8,
    /// Detailed description of the task.
    task_description: ?[]const u8 = null,
    /// Name of the teammate acting on the task.
    teammate_name: ?[]const u8 = null,
    /// Deprecated: a session-derived team name that will be removed.
    team_name: ?[]const u8 = null,
};

/// The main agent finished responding. Does not run after a user interrupt; an API error fires StopFailure instead. No matcher.
pub const Stop = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "Stop".
    hook_event_name: []const u8,
    /// true when Claude Code is already continuing because of a stop hook. Check it before blocking again; after eight continuations in a row Claude Code overrides the block.
    stop_hook_active: bool,
    /// The text of the final response. Use it instead of reading transcript_path, which can lag the turn.
    last_assistant_message: ?[]const u8 = null,
    /// The session's in-flight background tasks; empty when nothing is running. With session_crons it tells a finished session from one paused waiting for background work.
    background_tasks: ?[]const struct {
        /// Task identifier.
        id: []const u8,
        /// A task-type label such as shell, subagent, monitor, workflow, teammate, cloud session or MCP task.
        type: []const u8,
        /// Current task status.
        status: []const u8,
        /// Free-text description, capped at 1000 characters.
        description: ?[]const u8 = null,
        /// Shell command line. Only for shell tasks and monitor tasks that run a command.
        command: ?[]const u8 = null,
        /// Subagent type name. Only for subagent tasks.
        agent_type: ?[]const u8 = null,
        /// MCP server name. Only for monitor and MCP task tasks.
        server: ?[]const u8 = null,
        /// MCP tool name. Only for monitor and MCP task tasks.
        tool: ?[]const u8 = null,
        /// Workflow name. Only for workflow tasks.
        name: ?[]const u8 = null,
    } = null,
    /// The session's scheduled wakeups, from CronCreate, ScheduleWakeup and /loop.
    session_crons: ?[]const struct {
        /// Cron task identifier.
        id: []const u8,
        /// Cron expression, such as 0 9 * * 1-5.
        schedule: []const u8,
        /// false for a one-shot wakeup, true for a task that fires on every match.
        recurring: bool,
        /// The prompt submitted when the cron fires, capped at 1000 characters.
        prompt: []const u8,
    } = null,
};

/// The turn ended because of an API error. Runs instead of Stop. The matcher filters on error.
pub const StopFailure = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "StopFailure".
    hook_event_name: []const u8,
    /// The error type: rate_limit, authentication_failed, oauth_org_not_allowed, account_on_hold, billing_error, invalid_request, model_not_found, server_error (including HTTP 529), max_output_tokens, cloud_credential_error or unknown.
    @"error": []const u8,
    /// More detail about the error, when available.
    error_details: ?[]const u8 = null,
    /// The rendered error text shown in the conversation, not Claude's own output.
    last_assistant_message: ?[]const u8 = null,
};

/// An agent team teammate is about to go idle after its turn. No matcher.
pub const TeammateIdle = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "TeammateIdle".
    hook_event_name: []const u8,
    /// Name of the teammate about to go idle.
    teammate_name: []const u8,
    /// Deprecated: a session-derived team name that will be removed.
    team_name: ?[]const u8 = null,
};

/// A CLAUDE.md or .claude/rules/*.md file was loaded into context, at session start or lazily. Runs asynchronously. The matcher filters on load_reason.
pub const InstructionsLoaded = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "InstructionsLoaded".
    hook_event_name: []const u8,
    /// Absolute path of the instruction file that was loaded.
    file_path: []const u8,
    /// Scope of the file.
    memory_type: []const u8,
    /// Why the file was loaded. compact fires when files are re-loaded after a compaction.
    load_reason: []const u8,
    /// Path globs from the file's paths frontmatter. Only for path_glob_match loads.
    globs: ?[]const []const u8 = null,
    /// The file whose access triggered a lazy load.
    trigger_file_path: ?[]const u8 = null,
    /// The instruction file that included this one. Only for include loads.
    parent_file_path: ?[]const u8 = null,
};

/// A settings, managed policy or skill file changed during the session. The matcher filters on source.
pub const ConfigChange = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "ConfigChange".
    hook_event_name: []const u8,
    /// Which kind of configuration changed.
    source: []const u8,
    /// Path of the file that changed.
    file_path: ?[]const u8 = null,
};

/// A shell command in the main conversation changed the working directory. CLAUDE_ENV_FILE is set, and its variables are cleared at the next CwdChanged. No matcher.
pub const CwdChanged = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "CwdChanged".
    hook_event_name: []const u8,
    /// The previous working directory.
    old_cwd: []const u8,
    /// The new working directory.
    new_cwd: []const u8,
};

/// A working directory was added mid-session. The add has already completed and the hook runs in the background. The matcher filters on source.
pub const DirectoryAdded = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "DirectoryAdded".
    hook_event_name: []const u8,
    /// Absolute path of the directory that was added.
    directory: []const u8,
    /// slash_command for /add-dir, register_repo_root for the SDK control request.
    source: []const u8,
};

/// A watched file changed on disk, whatever changed it. The matcher is split on | into literal filenames to watch, not treated as a regex. CLAUDE_ENV_FILE is set.
pub const FileChanged = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "FileChanged".
    hook_event_name: []const u8,
    /// Absolute path of the file that changed.
    file_path: []const u8,
    /// What happened: modified, created or deleted.
    event: []const u8,
};

/// Claude Code is creating a worktree. A hook here replaces the default git worktree behaviour entirely, and .worktreeinclude is not processed. No matcher.
pub const WorktreeCreate = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "WorktreeCreate".
    hook_event_name: []const u8,
    /// A slug for the new worktree, user-specified or generated, such as bold-oak-a3f2.
    name: []const u8,
};

/// Claude Code is cleaning up a worktree a WorktreeCreate hook created. No matcher.
pub const WorktreeRemove = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "WorktreeRemove".
    hook_event_name: []const u8,
    /// Absolute path of the worktree being removed, as WorktreeCreate returned it.
    worktree_path: []const u8,
};

/// Claude Code is about to compact the conversation. The matcher filters on trigger.
pub const PreCompact = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PreCompact".
    hook_event_name: []const u8,
    /// manual for /compact, auto for automatic or idle compaction.
    trigger: []const u8,
    /// What the user passed to /compact; null when they passed nothing, and always null for auto.
    custom_instructions: ?[]const u8,
};

/// A compaction completed. The matcher filters on trigger.
pub const PostCompact = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PostCompact".
    hook_event_name: []const u8,
    /// manual after /compact, auto after automatic or idle compaction.
    trigger: []const u8,
    /// The conversation summary the compaction generated.
    compact_summary: []const u8,
};

/// A model switch the user or a client requested is about to apply. Claude Code 2.1.251 or later. The matcher compares against the canonical name of to_model; when none can be determined every hook runs, so check to_model too. Default timeout 30 seconds, and a timeout blocks the switch.
pub const PreModelSwitch = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PreModelSwitch".
    hook_event_name: []const u8,
    /// Model ID the switch changes from.
    from_model: []const u8,
    /// Model ID the switch changes to. The matcher compares against this model's canonical name.
    to_model: []const u8,
    /// The model the request named: an alias such as opus, a full model ID, or null for the default model or a change Claude Code made on its own.
    requested_model: ?[]const u8,
    /// Where the request came from: command for /model <name>, /config or fast mode; picker for a model picker; sdk for an Agent SDK host or Remote Control.
    source: []const u8,
    /// Tokens the next request re-sends as its prompt. 0 before the first response.
    context_tokens: f64,
    /// Whether the current model's prompt cache is likely still warm, so the switch forfeits it.
    prompt_cache_warm: bool,
    /// Prompt cache lifetime of the main conversation at the time of the switch.
    cache_ttl: []const u8,
    /// Estimated cost in US dollars of writing context_tokens to the prompt cache on to_model. An estimate only.
    estimated_cache_write_usd: f64,
    /// How the estimate was priced: your organization's rates, list price, or an assumed default rate.
    pricing: []const u8,
};

/// The session's model changed, including changes Claude Code makes on its own. Claude Code 2.1.251 or later. The matcher compares against the canonical name of to_model. Default timeout 30 seconds.
pub const PostModelSwitch = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "PostModelSwitch".
    hook_event_name: []const u8,
    /// Model ID the switch changes from.
    from_model: []const u8,
    /// Model ID the switch changes to. The matcher compares against this model's canonical name.
    to_model: []const u8,
    /// The model the request named: an alias such as opus, a full model ID, or null for the default model or a change Claude Code made on its own.
    requested_model: ?[]const u8,
    /// As on PreModelSwitch, plus auto for a fallback or other change Claude Code made itself and resume for the model restored on resume.
    source: []const u8,
    /// Tokens the next request re-sends as its prompt. 0 before the first response.
    context_tokens: f64,
    /// Whether the current model's prompt cache is likely still warm, so the switch forfeits it.
    prompt_cache_warm: bool,
    /// Prompt cache lifetime of the main conversation at the time of the switch.
    cache_ttl: []const u8,
    /// Estimated cost in US dollars of writing context_tokens to the prompt cache on to_model. An estimate only.
    estimated_cache_write_usd: f64,
    /// How the estimate was priced: your organization's rates, list price, or an assumed default rate.
    pricing: []const u8,
};

/// An MCP server requests user input during a tool call. The matcher filters on mcp_server_name.
pub const Elicitation = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "Elicitation".
    hook_event_name: []const u8,
    /// Name of the MCP server asking.
    mcp_server_name: []const u8,
    /// What the server is asking for.
    message: []const u8,
    /// form for a form request, url for a browser-based one.
    mode: ?[]const u8 = null,
    /// The URL to open. Only in url mode.
    url: ?[]const u8 = null,
    /// Identifier of the request.
    elicitation_id: ?[]const u8 = null,
    /// The JSON Schema of the form. Its property names are the keys an answer's content uses.
    requested_schema: ?std.json.Value = null,
};

/// The user responded to an MCP elicitation, before the response goes to the server. Does not run when an Elicitation hook answered. The matcher filters on mcp_server_name.
pub const ElicitationResult = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "ElicitationResult".
    hook_event_name: []const u8,
    /// Name of the MCP server.
    mcp_server_name: []const u8,
    /// What the user did. Check it is accept before returning accept, or a declined request becomes an accepted one.
    action: []const u8,
    /// The request's mode.
    mode: ?[]const u8 = null,
    /// Identifier of the request.
    elicitation_id: ?[]const u8 = null,
    /// The values the user submitted.
    content: ?std.json.Value = null,
};

/// The session is ending. A plugin's SessionEnd hooks share a 1.5 second budget that a plugin entry's timeout does not raise. The matcher filters on reason.
pub const SessionEnd = struct {
    /// Current session identifier.
    session_id: ?[]const u8 = null,
    /// Path to the conversation JSON. Written asynchronously, so it can lag the current turn; on Stop and SubagentStop read last_assistant_message instead.
    transcript_path: ?[]const u8 = null,
    /// Working directory when the hook is invoked. Follows Claude into a worktree or after a cd, while CLAUDE_PROJECT_DIR stays at the project root where the session started.
    cwd: ?[]const u8 = null,
    /// UUID of the user prompt being processed; matches the prompt.id attribute on OpenTelemetry events. Absent until the first user input.
    prompt_id: ?[]const u8 = null,
    /// Path to the session's scratchpad directory. Absent when the session has none or the temp directory is unavailable. Claude Code 2.1.257 or later.
    scratchpad_dir: ?[]const u8 = null,
    /// Current permission mode. The mode labelled Manual arrives as default. Not every event carries this field.
    permission_mode: ?[]const u8 = null,
    /// Present on events with a tool-use context, on models that support effort.
    effort: ?struct {
        /// The effort level that ran, including a skill's, subagent's or ultrathink level. CLAUDE_EFFORT holds the same value.
        level: []const u8,
    } = null,
    /// Unique identifier of the subagent or in-process teammate the hook fires in.
    agent_id: ?[]const u8 = null,
    /// Agent name, such as Explore or a plugin-scoped my-plugin:reviewer. Present inside a subagent, or when the session runs with --agent; a subagent's type wins over the session's.
    agent_type: ?[]const u8 = null,
    /// Always "SessionEnd".
    hook_event_name: []const u8,
    /// Why the session ended: clear, resume, logout, prompt_input_exit or other.
    reason: []const u8,
};

/// The `tool_input` of each built-in tool, as `Hook.toolInput` reads it.
pub const tools = struct {
    /// Arguments of the Bash tool, which executes shell commands.
    pub const Bash = struct {
        /// The command to execute.
        command: []const u8,
        /// What the command does.
        description: ?[]const u8 = null,
        /// Timeout in milliseconds. A value above the maximum is reduced to it.
        timeout: ?f64 = null,
        /// Whether to run the command in the background.
        run_in_background: ?bool = null,
    };

    /// Arguments of the PowerShell tool, which executes PowerShell commands; match Bash|PowerShell in a hook that inspects shell commands.
    pub const PowerShell = struct {
        /// The command to execute.
        command: []const u8,
        /// What the command does.
        description: ?[]const u8 = null,
        /// Timeout in milliseconds. A value above the maximum is reduced to it.
        timeout: ?f64 = null,
        /// Whether to run the command in the background.
        run_in_background: ?bool = null,
    };

    /// Arguments of the Write tool, which creates or overwrites a file.
    pub const Write = struct {
        /// Absolute path of the file to write. Claude Code expands ~ and relative paths before hooks run. On Windows it arrives with backslashes: normalize separators before comparing.
        file_path: []const u8,
        /// Content to write to the file.
        content: []const u8,
    };

    /// Arguments of the Edit tool, which replaces a string in an existing file.
    pub const Edit = struct {
        /// Absolute path of the file to edit. Claude Code expands ~ and relative paths before hooks run. On Windows it arrives with backslashes: normalize separators before comparing.
        file_path: []const u8,
        /// Text to find and replace.
        old_string: []const u8,
        /// Replacement text.
        new_string: []const u8,
        /// Whether to replace every occurrence.
        replace_all: ?bool = null,
    };

    /// Arguments of the Read tool, which reads file contents.
    pub const Read = struct {
        /// Absolute path of the file to read. Claude Code expands ~ and relative paths before hooks run. On Windows it arrives with backslashes: normalize separators before comparing.
        file_path: []const u8,
        /// Line number to start reading from.
        offset: ?f64 = null,
        /// Number of lines to read.
        limit: ?f64 = null,
    };

    /// Arguments of the Glob tool, which finds files matching a glob pattern.
    pub const Glob = struct {
        /// Glob pattern to match files against.
        pattern: []const u8,
        /// Directory to search in. Defaults to the current working directory.
        path: ?[]const u8 = null,
    };

    /// Arguments of the Grep tool, which searches file contents with regular expressions.
    pub const Grep = struct {
        /// Regular expression to search for.
        pattern: []const u8,
        /// File or directory to search in.
        path: ?[]const u8 = null,
        /// Glob pattern to filter files.
        glob: ?[]const u8 = null,
        /// Defaults to files_with_matches.
        output_mode: ?[]const u8 = null,
        /// Case insensitive search.
        @"-i": ?bool = null,
        /// Enable multiline matching.
        multiline: ?bool = null,
    };

    /// Arguments of the WebFetch tool, which fetches and processes web content.
    pub const WebFetch = struct {
        /// URL to fetch content from.
        url: []const u8,
        /// Prompt to run on the fetched content.
        prompt: []const u8,
        /// Characters to skip from the start of the page. Claude Code 2.1.290 or later.
        offset: ?f64 = null,
    };

    /// Arguments of the WebSearch tool, which searches the web.
    pub const WebSearch = struct {
        /// Search query.
        query: []const u8,
        /// Only include results from these domains.
        allowed_domains: ?[]const []const u8 = null,
        /// Exclude results from these domains.
        blocked_domains: ?[]const []const u8 = null,
        /// standard requests a lighter search, extended the full one. Claude Code 2.1.282 or later.
        mode: ?[]const u8 = null,
    };

    /// Arguments of the Agent tool, which spawns a subagent.
    pub const Agent = struct {
        /// The task for the agent to perform.
        prompt: []const u8,
        /// Short description of the task.
        description: ?[]const u8 = null,
        /// Type of specialized agent to use, such as Explore.
        subagent_type: ?[]const u8 = null,
        /// Model alias to override the default, such as sonnet.
        model: ?[]const u8 = null,
    };

    /// Arguments of the AskUserQuestion tool, which asks the user one to four multiple-choice questions. To answer from a PreToolUse hook, return allow with updatedInput holding the original questions plus answers.
    pub const AskUserQuestion = struct {
        /// The questions to present.
        questions: []const struct {
            /// The question text.
            question: []const u8,
            /// A short header.
            header: []const u8,
            /// The choices.
            options: []const struct {
                /// The option's label.
                label: []const u8,
                /// What the option means.
                description: ?[]const u8 = null,
            },
            /// Whether several options may be chosen.
            multiSelect: ?bool = null,
        },
        /// Maps question text to the chosen option label; multi-select answers join labels with commas. Claude never sets it: supply it through updatedInput.
        answers: ?std.json.Value = null,
    };

    /// Arguments of the ExitPlanMode tool, which presents a plan for approval. Claude Code injects the plan content and path before hooks see the input.
    pub const ExitPlanMode = struct {
        /// Plan content in Markdown, injected from the plan file.
        plan: ?[]const u8 = null,
        /// Path to the plan file, injected.
        planFilePath: ?[]const u8 = null,
        /// Deprecated: accepted and ignored.
        allowedPrompts: ?[]const std.json.Value = null,
    };
};
