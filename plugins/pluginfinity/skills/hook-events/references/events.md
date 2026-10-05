# Hook events

One section per event in the library's set. Field names are Claude Code's. Copilot's PascalCase form carries the same names in snake_case, except where a section says otherwise. Every event also receives `session_id`, `cwd` and `hook_event_name` (Claude Code hooks docs). Choose an event with the [hook-events](../SKILL.md) skill.

## SessionStart

- Input: `source` (`startup`, `resume`, `clear`, `compact` or `fork`), and optionally `model` and `agent_type` (Claude Code hooks docs).
- `CLAUDE_ENV_FILE` exists only on SessionStart, Setup, CwdChanged and FileChanged. Append `export` lines to it to carry variables into later Bash commands (Claude Code hooks docs).
- `resume` fires SessionStart again, so guard each write to `CLAUDE_ENV_FILE` against duplicates (plugin-bot hook-scripts).
- Copilot context was delivered in one live run and not in the next. Copilot CLI 1.0.91, 2026-10-03.

## SessionEnd

- Input: `reason` (`clear`, `resume`, `logout`, `prompt_input_exit` or `other`) (Claude Code hooks docs).
- SessionEnd hooks share a 1.5 second budget on Claude Code. A longer per-hook `timeout` raises it, but not for a plugin's hook, so keep the script quick (Claude Code hooks docs).
- No response is honoured, and stderr reaches the user only (Claude Code hooks docs).

## UserPromptSubmit

- Input: `prompt` (Claude Code hooks docs).
- Claude Code cannot replace the prompt here. A block's `reason` goes to the user and not into context (Claude Code hooks docs).
- A `systemMessage` is shown to the user and not added to model context. Claude Code 2.1.288.
- Copilot fires it for each typed prompt and for a subagent's prompt, under the subagent's own session id, and not for a form or question-tool reply. Copilot CLI 1.0.91, 2026-10-03.
- Copilot drops the output of a command hook on this event, so a block or context does nothing there (GitHub Copilot hooks reference).

## PreToolUse

- Input: `tool_name`, `tool_input` and `tool_use_id`, plus `mcp_server` for an MCP tool (Claude Code hooks docs).
- The only event for `hook_deny`, `hook_allow` and `hook_ask`. When hooks disagree on Claude Code, deny beats ask, which beats allow (Claude Code hooks docs).
- On Copilot `tool_input` keeps Copilot's key names (`path`, `file_text`, `old_str`, `new_str`). A hook reading `tool_input.file_path` never fired on Copilot's Read. Copilot CLI 1.0.91, 2026-10-03.
- A non-zero exit denies the call on Copilot and lets it proceed on Claude Code (GitHub Copilot hooks reference; Claude Code hooks docs). A timeout is fail-open on both.

## PostToolUse

- Input: `tool_name`, `tool_input`, `tool_response` and `tool_use_id` (Claude Code hooks docs). On Copilot the result arrives as `tool_result` (`result_type`, `text_result_for_llm`) (GitHub Copilot hooks reference).
- The `tool_response` of an MCP tool is an array, not an object (plugin-bot hook-scripts).
- The tool has already run, so a block only adds its `reason` beside the result (Claude Code hooks docs).
- Context was delivered on both hosts. Claude Code 2.1.288; Copilot CLI 1.0.91, 2026-10-03.

## PostToolUseFailure

- Input: `tool_name`, `tool_input`, `tool_use_id` and `error`, and optionally `is_interrupt` (Claude Code hooks docs).
- The Claude Code docs document only `additionalContext` for it, so the library offers context and no block (Claude Code hooks docs).
- Copilot reads exit code 2 from this hook as context, and the library has no emitter for it there. Use `hook_raw` only if you need that (GitHub Copilot hooks reference).

## Stop

- Input: `stop_hook_active`, `last_assistant_message`, and `background_tasks` (Claude Code hooks docs).
- `stop_hook_active` is true when the agent already continues because of a stop hook. Check it before blocking again. After eight consecutive blocks Claude Code ends the turn regardless, and Copilot does the same (Claude Code hooks docs; GitHub Copilot hooks reference).
- Copilot's `agentStop` form carries `stopReason` and `transcriptPath` (GitHub Copilot hooks reference).
- A block stopped once and then allowed on both hosts. Claude Code 2.1.288; Copilot CLI 1.0.91, 2026-10-03.

## SubagentStart

- Input: `agent_id` and `agent_type` (Claude Code hooks docs).
- Context only. On Claude Code the subagent receives it. On Copilot it is placed at the top of the subagent's first prompt, and the built-in `general-purpose` agent emits no `subagentStart` (GitHub Copilot hooks reference). Copilot CLI 1.0.91, 2026-10-03.
- Subagent hooks reuse the parent `session_id` on Claude Code, so key per-agent state on `agent_id` (Claude Code hooks docs).

## SubagentStop

- Input: `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path` and `last_assistant_message` (Claude Code hooks docs).
- The same `stop_hook_active` and eight-block cap as Stop apply (Claude Code hooks docs). Key per-agent state on `agent_id`, not `session_id`.
- Copilot also accepts `modifiedResponse`, which the library does not emit (GitHub Copilot hooks reference).

## PreCompact

- Input: `trigger` (`manual` or `auto`) and `custom_instructions` (Claude Code hooks docs).
- A block works on Claude Code. `systemMessage` and `continue` are discarded there (Claude Code hooks docs).
- Copilot honours no output from it (GitHub Copilot hooks reference).

## Notification

- Input: `message` and `notification_type`, and optionally `title` (Claude Code hooks docs; GitHub Copilot hooks reference).
- Claude Code ignores any response and exit code here (Claude Code hooks docs).
- On Copilot, context is injected as a user message and can start further agent work if the session is idle. The hook never blocks (GitHub Copilot hooks reference).
- Copilot's `notification` has no PascalCase form, so it always arrives in camelCase fields (GitHub Copilot hooks reference).

## PermissionRequest

- Input: `tool_name` and `tool_input`, and optionally `permission_suggestions`. There is no `tool_use_id` (Claude Code hooks docs).
- Claude Code decides through `hookSpecificOutput.decision.behavior` (`allow` or `deny`), and ignores exit 2 here (Claude Code hooks docs). Copilot answers with `behavior`, `message` and `interrupt`, and reads exit 2 as deny (GitHub Copilot hooks reference).
- `hook_deny` and `hook_allow` build the PreToolUse shape and do not cover either. Send the object with `hook_raw claude '<json>'` and `hook_raw copilot '<json>'`.
