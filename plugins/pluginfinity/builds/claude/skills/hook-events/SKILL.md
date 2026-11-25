---
name: hook-events
description: >-
  Use when choosing which hook event a pluginfinity hook should use, when a hook behaves differently on
  Claude Code and GitHub Copilot, or when deciding whether an event needs fallback omit on Copilot.
  Covers what each event can do on each host, the input each sends, and the measured host differences.
---

# Choosing a hook event

Pick the event by what the hook must do, then check the table for what each host honours. The hook library sends a response only where the host honours it, and does nothing elsewhere, so a script written for the richer host stays safe on the other. Write the script with the [hook-authoring](../hook-authoring/SKILL.md) skill.

## What each event can do

Each cell lists the library responses the host honours for the event. `hook_noop` and `hook_raw` work everywhere, so they are left out. A `—` means no `hook_*` response does anything. Ask at run time with `hook_supports <capability> <Event>`.

| Event | Claude | Copilot | Typical use |
| :-- | :-- | :-- | :-- |
| SessionStart | `hook_context`, `hook_system_message` | `hook_context` | Tell the agent about the project |
| SessionEnd | — | — | Clean up or log; the response is ignored |
| UserPromptSubmit | `hook_context`, `hook_block`, `hook_system_message` | — | Add context to or reject a prompt |
| PreToolUse | `hook_deny`, `hook_allow`, `hook_ask`, `hook_context`, `hook_system_message` | `hook_deny`, `hook_allow`, `hook_ask` | Guard or rewrite a tool call |
| PostToolUse | `hook_context`, `hook_block`, `hook_system_message` | `hook_context` | React to a finished tool call |
| PostToolUseFailure | `hook_context`, `hook_system_message` | — | Add context after a failed call (Claude only) |
| Stop | `hook_context`, `hook_block`, `hook_system_message` | `hook_block` | Keep the agent working until a condition clears |
| SubagentStart | `hook_context`, `hook_system_message` | `hook_context` | Give a subagent context |
| SubagentStop | `hook_context`, `hook_block`, `hook_system_message` | `hook_block` | Gate a subagent's result |
| PreCompact | `hook_block` | — | Stop a compaction |
| Notification | — | `hook_context` | Log or react to a notification |
| PermissionRequest | `hook_system_message` | — | Decide a permission prompt through `hook_raw` |
| PreSkillShellCommand | `hook_deny`, `hook_block`, `hook_system_message` | — | Refuse a shell command a skill injects while it loads (Claude Code 2.1.332 or later) |
| PreModelSwitch | `hook_deny`, `hook_allow`, `hook_ask`, `hook_block`, `hook_system_message` | — | Refuse or confirm a model switch |
| TaskCompleted, TeammateIdle | `hook_block`, `hook_system_message` | — | Keep a task open or a teammate working |
| Elicitation, ElicitationResult | `hook_block` | — | Decline an MCP server's request for input |

Sources: the capability cells mirror `hook_supports` in the hook library, which follows the Claude Code hooks docs and the GitHub Copilot hooks reference. `hook_deny`, `hook_allow` and `hook_ask` answer PreToolUse on both hosts; on Claude Code they also answer PreModelSwitch, and `hook_deny` answers PreSkillShellCommand, where an allow changes nothing and an ask is read as a deny. `PostToolUseFailure` blocking is not offered on Claude Code, because the docs describe its decision output as `additionalContext` only (Claude Code hooks docs). Copilot drops command output from `userPromptSubmitted` (GitHub Copilot hooks reference), and `Notification` is context only on Copilot, where it can start more agent work if the session is idle. Claude Code discards a `systemMessage` on `Setup`, `InstructionsLoaded`, `MessageDisplay`, `Notification`, `StopFailure`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `SessionEnd`, `Elicitation` and `ElicitationResult`, hands `DirectoryAdded`'s to Claude instead of the user, and takes no context on `Notification` or `PreCompact` (Claude Code hooks docs, read 2026-11-25).

`PermissionRequest` answers with a `decision` object that `hook_deny` and `hook_allow` do not build. Send it with `hook_raw claude '<json>'`, and give Copilot its own shape with `hook_raw copilot '<json>'`.

## The exact shape of an event

Claude Code documents its hook events as prose. This skill ships each one as a JSON Schema instead, generated from the schemas pluginfinity checks its own hook library against. Read only the file for the event you are writing a hook for; do not load the directory.

| File under `references/schemas/` | What it describes |
| :-- | :-- |
| `<Event>.input.schema.json` | The JSON the hook receives on stdin: the common fields and the event's own, each with when it is present |
| `<Event>.output.schema.json` | The JSON the hook may print: the fields Claude Code reads on that event. A field it discards there is absent, and named in the schema's description |
| `tool-input.<Tool>.schema.json` | The `tool_input` of a built-in tool (`Bash`, `PowerShell`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Agent`, `AskUserQuestion`, `ExitPlanMode`) |

`<Event>` is the Claude Code name, such as `PreToolUse` or `SessionStart`, so the path is `references/schemas/PreToolUse.input.schema.json`.

- The schemas describe Claude Code only. Copilot sends camelCase keys and its own `tool_input` names; `hook_input` reads either, as the notes below say.
- Each schema's `description` says what the event is for, what its matcher filters on, and what exit code 2 does. A field's description gives the minimum Claude Code version where the docs state one.
- Inputs allow unknown properties, because Claude Code adds fields between releases.
- An output field with no `hook_*` helper, such as `updatedToolOutput`, `sessionTitle` or `watchPaths`, is sent with `hook_raw claude '<json>'`.
- The schemas were written from the Claude Code hooks reference as read on 2026-11-25. Where that page is unclear a description says so: `PostToolUseFailure`'s `decision`, and where `watchPaths` sits on `CwdChanged` and `FileChanged`.

## Claude-only events

Of Claude Code's events, Copilot runs only the first twelve above. A hook on any other Claude Code event, such as Setup, UserPromptExpansion, PermissionDenied or PostToolBatch, fails the Copilot build unless every entry for it sets `fallback: "omit"`, which leaves it out of that build and lists it as a `hook-omitted` note under the Copilot line of the build output. The full list is in [hooks](../pluginfinity/references/hooks.md).

```ts
hooks: {
  PostToolBatch: [{ script: "hooks/after-batch.sh", fallback: "omit" }],
  PreToolUse: [{ matcher: "Bash", script: "hooks/guard.sh" }],
},
```

The omitted event is simply absent on Copilot, so keep anything the plugin depends on in an event both hosts run.

## Host differences that change how you write a hook

- A `failClosed` entry is also written with Claude Code's `onFailure: "block"`, so a hook that cannot start or times out stops the action there. Copilot has no such field; on Copilot a non-zero exit denies on `preToolUse` only.
- A plugin's `SessionEnd` hooks share a 1.5 second budget on Claude Code, and a plugin entry's `timeout` does not raise it. Keep a `SessionEnd` hook short (Claude Code hooks docs, read 2026-11-25).
- `hook_context` on `Stop` or `SubagentStop` keeps Claude working on the text, like a block that is not shown as an error, and counts toward the same cap of eight continuations in a row (Claude Code hooks docs, read 2026-11-25).
- Context and system-message text over 10,000 characters is saved to a file on Claude Code, and Claude gets the path and the first 2,000 characters. Keep what Claude must see under the cap.
- On Claude Code a `Bash` matcher on `PreToolUse` or `PermissionRequest` also runs for commands started with the Monitor tool, where an allow or a rewritten input has no effect (Claude Code 2.1.314 or later).
- A `PreSkillShellCommand` entry makes Claude Code older than 2.1.332 warn about an unknown hook event when it loads the plugin.

- Copilot keeps its own key names inside `tool_input`: Read sends `path`, Write sends `path` and `file_text`, Edit sends `path`, `old_str` and `new_str`. `hook_input tool_input.<claude key>` reads either spelling. `hook_input tool_input` (the whole object) and the JSON you give `hook_allow` use Copilot's names there. Copilot CLI 1.0.91, 2026-10-03.
- Copilot ignores a `matcher` on `SessionStart`, `SessionEnd` and `SubagentStop`. The build passes it as `PLUGINFINITY_MATCHER` and notes it as `hook-matcher-runtime`, and the hook library applies it against `source`, `reason` and `agent_type`, but only for a `script` entry that sources `hook.sh`. A plain `command` entry runs for every source on Copilot (GitHub Copilot hooks reference).
- Copilot reports a fresh session's SessionStart `source` as `new`, where Claude Code says `startup`. The build widens a matcher list holding `startup` to `startup|new` on Copilot and notes `hook-matcher-widened`; a regex that matches `startup` but not `new` is left as written with a `hook-matcher-regex` note. Copilot CLI 1.0.92, 2026-10-07.
- Values a SessionStart hook puts in `CLAUDE_ENV_FILE` reach Claude Code's Bash tool and no later hook (Claude Code 2.1.292, 2026-10-07), and Copilot has no such channel. Share session values through the config's `env` instead: every hook that sources `hook.sh` reads them, and `hook_supports env-shell` says whether the model's shell does. See [session env](${CLAUDE_PLUGIN_ROOT}/skills/pluginfinity/references/session-env.md).
- Copilot sends no `hook_event_name` on a camelCase entry. The build sets `PLUGINFINITY_EVENT` on every Copilot entry, so `hook_event` works there. Copilot CLI 1.0.91, 2026-10-03.
- Copilot delivers `SubagentStart` context by putting it at the top of the subagent's first prompt. Copilot CLI 1.0.91, 2026-10-03.
- Copilot fires UserPromptSubmit for a subagent's prompt, under the subagent's own session id, and does not fire it for a reply submitted through a form or question tool. Copilot CLI 1.0.91, 2026-10-03.
- Claude Code shows a UserPromptSubmit `systemMessage` to the user and does not add it to model context. Claude Code 2.1.288.
- On Copilot, any non-zero exit from a `preToolUse` hook denies the call, where Claude Code lets the call proceed (GitHub Copilot hooks reference). The library's exit trap turns a crash into a clean exit and a fail-open response, so scripts never exit non-zero. Set `failClosed: true` on the entry, or call `hook_fail_closed`, for a guard that must deny when it fails.
- Copilot SessionStart context was seen in one live run and not in the next, so do not make a hook depend on it alone. Copilot CLI 1.0.91, 2026-10-03.
- Claude Code subagent hooks reuse the parent `session_id`. Key per-agent state on `agent_id` (Claude Code hooks docs).

## More

- [Per-event input and gotchas](references/events.md)
- [Hook configuration and library](../pluginfinity/references/hooks.md)
