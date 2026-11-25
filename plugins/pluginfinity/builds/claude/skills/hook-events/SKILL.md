---
name: hook-events
description: >-
  Use when choosing which hook event a pluginfinity hook should use, when checking what a hook receives or
  may answer on an event, when a hook behaves differently on Claude Code and GitHub Copilot, or when
  deciding whether an event needs fallback omit on Copilot. The contract both kinds of hook share, bash
  and native: what each event can do on each host, the exact input and output of each, and the measured
  host differences.
---

# The hook contract

A hook receives one event as JSON and may send one answer. What it receives and what the host does with the answer depend on the event and the host, not on how the hook is written. This skill holds that contract. Write the hook with the [bash-hooks](../bash-hooks/SKILL.md) skill, as a bash script on the hook library, or with the [native-hooks](../native-hooks/SKILL.md) skill, as a compiled program. Both libraries send an answer only where the host honours it and do nothing elsewhere, so a hook written for the richer host stays safe on the other.

## Answers

A hook answers with one of these. The tables below name them by the first column.

| Answer | Bash | Native | What it does |
| :-- | :-- | :-- | :-- |
| context | `hook_context "<text>"` | `h.context(text)` | Adds text to the model's context |
| deny | `hook_deny "<reason>"` | `h.deny(reason)` | Refuses the action; the model sees the reason |
| allow | `hook_allow [reason] [json]` | `h.allow(reason)`, `h.allowWith(reason, json)` | Approves the action, or rewrites its input |
| ask | `hook_ask "<reason>"` | `h.ask(reason)` | Hands the decision to the user |
| block | `hook_block "<reason>"` | `h.block(reason)` | Stops the step and gives the model the reason |
| system message | `hook_system_message "<text>"` | `h.systemMessage(text)` | Shows the user a line; the model does not see it |
| nothing | `hook_noop` | `h.noop()` | Lets the action proceed. Works everywhere |
| raw | `hook_raw <host> '<json>'` | `h.raw(host, json)` | Sends JSON as is, on the named host only. Works everywhere |

Ask at run time whether the host honours one on the current event: `hook_supports <answer> [Event]` in bash, `h.can(.<answer>)` in a native hook.

## What each event can do

Each cell lists the answers the host honours for the event. A `—` means it honours none.

| Event | Claude | Copilot | Typical use |
| :-- | :-- | :-- | :-- |
| SessionStart | context, system message | context | Tell the agent about the project |
| SessionEnd | — | — | Clean up or log; the response is ignored |
| UserPromptSubmit | context, block, system message | — | Add context to or reject a prompt |
| PreToolUse | deny, allow, ask, context, system message | deny, allow, ask | Guard or rewrite a tool call |
| PostToolUse | context, block, system message | context | React to a finished tool call |
| PostToolUseFailure | context, system message | — | Add context after a failed call (Claude only) |
| Stop | context, block, system message | block | Keep the agent working until a condition clears |
| SubagentStart | context, system message | context | Give a subagent context |
| SubagentStop | context, block, system message | block | Gate a subagent's result |
| PreCompact | block | — | Stop a compaction |
| Notification | — | context | Log or react to a notification |
| PermissionRequest | system message | — | Decide a permission prompt with a raw answer |
| PreSkillShellCommand | deny, block, system message | — | Refuse a shell command a skill injects while it loads (Claude Code 2.1.332 or later) |
| PreModelSwitch | deny, allow, ask, block, system message | — | Refuse or confirm a model switch |
| TaskCompleted, TeammateIdle | block, system message | — | Keep a task open or a teammate working |
| Elicitation, ElicitationResult | block | — | Decline an MCP server's request for input |

Sources: the cells mirror `hook_supports` in the bash library, which the native library is tested to agree with, and which follows the Claude Code hooks docs and the GitHub Copilot hooks reference. Deny, allow and ask answer PreToolUse on both hosts; on Claude Code they also answer PreModelSwitch, and deny answers PreSkillShellCommand, where an allow changes nothing and an ask is read as a deny. `PostToolUseFailure` blocking is not offered on Claude Code, because the docs describe its decision output as `additionalContext` only (Claude Code hooks docs). Copilot drops command output from `userPromptSubmitted` (GitHub Copilot hooks reference), and `Notification` is context only on Copilot, where it can start more agent work if the session is idle. Claude Code discards a `systemMessage` on `Setup`, `InstructionsLoaded`, `MessageDisplay`, `Notification`, `StopFailure`, `ConfigChange`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `SessionEnd`, `Elicitation` and `ElicitationResult`, hands `DirectoryAdded`'s to Claude instead of the user, and takes no context on `Notification` or `PreCompact` (Claude Code hooks docs, read 2026-11-25).

`PermissionRequest` answers with a `decision` object that deny and allow do not build. Send it as a raw answer for `claude`, and give Copilot its own shape with a raw answer for `copilot`.

## The exact shape of an event

Claude Code documents its hook events as prose. This skill ships each one as a JSON Schema instead, generated from the schemas pluginfinity checks its own hook library against. Read only the file for the event you are writing a hook for; do not load the directory.

| File under `references/schemas/` | What it describes |
| :-- | :-- |
| `<Event>.input.schema.json` | The JSON the hook receives on stdin: the common fields and the event's own, each with when it is present |
| `<Event>.output.schema.json` | The JSON the hook may print: the fields Claude Code reads on that event. A field it discards there is absent, and named in the schema's description |
| `tool-input.<Tool>.schema.json` | The `tool_input` of a built-in tool (`Bash`, `PowerShell`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Agent`, `AskUserQuestion`, `ExitPlanMode`) |

`<Event>` is the Claude Code name, such as `PreToolUse` or `SessionStart`, so the path is `references/schemas/PreToolUse.input.schema.json`.

- The schemas describe Claude Code only. Copilot sends camelCase keys and its own `tool_input` names; both libraries read either by Claude Code's names (`hook_input` in bash, `h.input` in a native hook), as the notes below say.
- Each schema's `description` says what the event is for, what its matcher filters on, and what exit code 2 does. A field's description gives the minimum Claude Code version where the docs state one.
- Inputs allow unknown properties, because Claude Code adds fields between releases.
- An output field with no answer of its own, such as `updatedToolOutput`, `sessionTitle` or `watchPaths`, is sent as a raw answer for `claude`.
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
- Context on `Stop` or `SubagentStop` keeps Claude working on the text, like a block that is not shown as an error, and counts toward the same cap of eight continuations in a row (Claude Code hooks docs, read 2026-11-25).
- Context and system-message text over 10,000 characters is saved to a file on Claude Code, and Claude gets the path and the first 2,000 characters. Keep what Claude must see under the cap.
- On Claude Code a `Bash` matcher on `PreToolUse` or `PermissionRequest` also runs for commands started with the Monitor tool, where an allow or a rewritten input has no effect (Claude Code 2.1.314 or later).
- A `PreSkillShellCommand` entry makes Claude Code older than 2.1.332 warn about an unknown hook event when it loads the plugin.

- Copilot keeps its own key names inside `tool_input`: Read sends `path`, Write sends `path` and `file_text`, Edit sends `path`, `old_str` and `new_str`. Reading one key by its Claude Code name works in both libraries (`hook_input tool_input.<claude key>`, `h.input("tool_input.<claude key>")`). The whole `tool_input` object, and the rewritten input you send with an allow, use Copilot's names there. Copilot CLI 1.0.91, 2026-10-03.
- Copilot ignores a `matcher` on `SessionStart`, `SessionEnd` and `SubagentStop`. The build passes it as `PLUGINFINITY_MATCHER` and notes it as `hook-matcher-runtime`, and the hook libraries apply it against `source`, `reason` and `agent_type`: for a `script` entry that sources `hook.sh`, and for a `binary` entry built on the native library. A plain `command` entry runs for every source on Copilot (GitHub Copilot hooks reference).
- Copilot reports a fresh session's SessionStart `source` as `new`, where Claude Code says `startup`. The build widens a matcher list holding `startup` to `startup|new` on Copilot and notes `hook-matcher-widened`; a regex that matches `startup` but not `new` is left as written with a `hook-matcher-regex` note. Copilot CLI 1.0.92, 2026-10-07.
- Values a SessionStart hook puts in `CLAUDE_ENV_FILE` reach Claude Code's Bash tool and no later hook (Claude Code 2.1.292, 2026-10-07), and Copilot has no such channel. Share session values through the config's `env` instead: every hook on either library reads them (plain variables in bash, `h.env` in a native hook), and `hook_supports env-shell` in bash says whether the model's shell does. See [session env](${CLAUDE_PLUGIN_ROOT}/skills/pluginfinity/references/session-env.md).
- Copilot sends no `hook_event_name` on a camelCase entry. The build sets `PLUGINFINITY_EVENT` on every Copilot entry, so `hook_event` in bash and `h.event` in a native hook are right there. Copilot CLI 1.0.91, 2026-10-03.
- Copilot delivers `SubagentStart` context by putting it at the top of the subagent's first prompt. Copilot CLI 1.0.91, 2026-10-03.
- Copilot fires UserPromptSubmit for a subagent's prompt, under the subagent's own session id, and does not fire it for a reply submitted through a form or question tool. Copilot CLI 1.0.91, 2026-10-03.
- Claude Code shows a UserPromptSubmit `systemMessage` to the user and does not add it to model context. Claude Code 2.1.288.
- On Copilot, any non-zero exit from a `preToolUse` hook denies the call, where Claude Code lets the call proceed (GitHub Copilot hooks reference). Both libraries turn a crash into a clean exit and a fail-open response, so a hook never exits non-zero. Set `failClosed: true` on the entry for a guard that must deny when it fails.
- Copilot SessionStart context was seen in one live run and not in the next, so do not make a hook depend on it alone. Copilot CLI 1.0.91, 2026-10-03.
- Claude Code subagent hooks reuse the parent `session_id`. Key per-agent state on `agent_id` (Claude Code hooks docs).

## More

- [Per-event input and gotchas](references/events.md)
- [Hook entries in the config](../pluginfinity/references/hooks.md): the fields, the handlers, the failure policy and what ships
