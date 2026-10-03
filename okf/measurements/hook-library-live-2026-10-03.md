---
type: Measurement
title: Hook library live run on Claude Code and Copilot CLI, 2026-10-03
description: What the dogfood plugin's marker-triggered hooks and a throwaway Copilot probe build showed under Claude Code 2.1.288 and GitHub Copilot CLI 1.0.91, and what each finding changed in the hook library, its tests and its docs.
tags:
  - portability
  - testing
  - dx
status: draft
stale_after: 2027-01-01T00:00:00Z
justifies: ../decisions/hook-library-is-build-injected.md
sources:
  - id: owner-live-runs
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-03T00:00:00Z
    title: Live runs of the dogfood plugin under pnpm claude:debug and pnpm copilot:debug, and of a throwaway Copilot probe build, made in sessions the owner directed
  - id: copilot-hooks-reference
    resource: https://docs.github.com/en/copilot/reference/hooks-configuration
    title: GitHub Copilot hooks configuration reference
generated:
  by: okfit/claude-code
  at: 2026-10-03T20:49:08Z
  body_sha256: 234b05ca3d8dbe67797a399de5402842f4800c00b45c9ddbca9bdd75fdbb35f1
---

# Hook library live run on Claude Code and Copilot CLI, 2026-10-03

## Method

The [hook library](../decisions/hook-library-is-build-injected.md) was written against the documented payloads and exit-code contracts of both hosts, and tested under bats with fixtures built from those documents. This run checks the library against the real hosts. Hosts were Claude Code 2.1.288 and GitHub Copilot CLI 1.0.91, both on macOS.[^owner-live-runs]

- **Dogfood plugin.** The [dogfood fixture](../modules/dogfood.md) declares marker-triggered hooks: a marker string in a prompt, a command or a file name makes one hook respond in a way an observer can recognise. Each host ran the built plugin in a debug session, `pnpm claude:debug` or `pnpm copilot:debug`, which sets `PLUGINFINITY_HOOK_DEBUG=1`. An agent in the session performed the ten-step checklist and the owner confirmed what only a person at the terminal could see.
- **Probe build.** A throwaway Copilot build with catch-all logging hooks, one per event, recorded the raw payload and the environment each hook received. It was not committed.

## Results

| Check | Claude Code 2.1.288 | Copilot CLI 1.0.91 |
| :-- | :-- | :-- |
| SessionStart context | Present, naming the host and source | Seen in one run, not reported in the next; inconclusive |
| UserPromptSubmit system message | Not shown to the user; the hook printed it when replayed by hand | Nothing shown, as designed, with one debug line that the call does nothing on Copilot |
| PreToolUse deny | Blocked with the hook's reason | Blocked with the hook's reason |
| PreToolUse crash fails open | Read succeeded and the error log gained an `exited 1` line | The hook never fired: it read `tool_input.file_path` and Copilot's Read sends `path` |
| PostToolUse context | Delivered | Delivered |
| SubagentStart context | Delivered to the subagent | Not noticed by a subagent asked whether it saw the context; the probe build showed it delivered (see findings) |
| Unknown-event sanity | Only the crash line in the error log | No new lines from the dogfood scripts; an unrelated probe plugin on the machine wrote into the same log |
| Debug log | Never created, since no function was a no-op on Claude | One line, the `hook_system_message` no-op |
| Stop block | Blocked once, then allowed | Blocked once, then allowed |

## Findings

- **Copilot keeps its own `tool_input` key names under PascalCase events.** `tool_name` is mapped to the Claude names (`Read`, `Write`, `Edit`, `Bash`, `Agent`, `AskUserQuestion`), but the keys inside `tool_input` are not: Read sends `path`, Write sends `path` and `file_text`, Edit sends `path`, `old_str` and `new_str`. Bash sends `command` and `description`, the same as Claude.
- **The entry `env` is honoured.** `PLUGINFINITY_EVENT` arrived as set on each Copilot entry. A camelCase entry without `env` got a payload with no `hook_event_name`.
- **`tool_input` is a JSON object and `hook_event_name` is present** on a PascalCase event, snake_case, at the top level.
- **A `subagentStart` hook's `additionalContext` is delivered by putting it at the top of the subagent's first prompt.** A subagent asked about its context in general did not report it; asked to quote the first line of its prompt, it can.[^copilot-hooks-reference]
- **UserPromptSubmit fires on every typed prompt, and for a subagent's prompt under the subagent's own session id.** It does not fire for a reply submitted through a form or question tool.
- **Claude 2.1.288 did not show a UserPromptSubmit `systemMessage`** although the hook printed it. This was observed once and is unconfirmed; the docs list `systemMessage` as a universal output and do not say this event discards it.
- **Copilot SessionStart context was inconclusive.** Two consecutive sessions on the same plugin disagreed about whether the context was visible, so the run neither confirms nor rules out delivery. An earlier [SessionStart measurement](copilot-pascalcase-sessionstart-context.md) saw it delivered.

## What each finding changed

- **Key aliasing.** `hook_input` reads a `tool_input.<key>` by its Claude name on both hosts and falls back to the Copilot spelling when the Claude key is null: `file_path` to `path`, `content` to `file_text`, `old_string` to `old_str`, `new_string` to `new_str`. A Claude payload finds its own key first, so the filter stays free of host checks.
- **Raw-input debug line.** With `PLUGINFINITY_HOOK_DEBUG=1` each hook writes its raw input, truncated, to the debug log, so a maintainer sees what a host sends without editing a build.
- **Dogfood crash test.** A bats test runs the crash hook on Copilot's Read shape, since the live run never reached it, and asserts it fails open.
- **The hook-eval skill.** The live checklist became a skill in the dogfood plugin, so a debug session can run it and write a report. Its Copilot and Claude host blocks carry the subagent-prompt, typed-prompt and unconfirmed-`systemMessage` caveats above.
- **Docs.** The companion's hooks reference teaches the alias table, that `hook_allow` passes `updatedInput` through unchanged, and the host notes above.

## What this rules in and out

- The `env` route for the event name works on Copilot, so the library needs no per-event command prefix.
- It covers one machine, one session per check, and the two host versions named. The UserPromptSubmit `systemMessage` and SessionStart results need a repeat before anything relies on either.

[^owner-live-runs]: conversation with the repository owner, 2026-10-03
[^copilot-hooks-reference]: <https://docs.github.com/en/copilot/reference/hooks-configuration>
