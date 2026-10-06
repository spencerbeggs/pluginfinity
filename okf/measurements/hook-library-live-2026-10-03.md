---
type: Measurement
title: Hook library live run on Claude Code and Copilot CLI, 2026-10-03
description: What the dogfood plugin's marker-triggered hooks and a throwaway Copilot probe build showed under Claude Code 2.1.288 and GitHub Copilot CLI 1.0.91, and what a second run on 2026-10-05 showed for the companion's plugin-engineer agent and skills; what each finding changed in the hook library, its tests and its docs.
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
  - id: hook-eval-reports-2026-10-05
    resource: ../../.pluginfinity/hook-eval/claude-20261005-1204.md
    title: The hook-eval report written by the Claude Code session on 2026-10-05, with the Copilot report beside it as copilot-20261005-1202.md
  - id: copilot-hooks-reference
    resource: https://docs.github.com/en/copilot/reference/hooks-configuration
    title: GitHub Copilot hooks configuration reference
generated:
  by: okfit/claude-code
  at: 2026-10-05T16:27:40Z
  body_sha256: d37b49f6a931d37f54b803e20d76f23dbe97b656390c35d6e4bf28881928b9b5
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
| UserPromptSubmit system message | Shown in the UI as "UserPromptSubmit says: ..."; not added to model context. The first run did not show it; a second run did | Nothing shown, as designed, with one debug line that the call does nothing on Copilot |
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
- **Claude 2.1.288 shows a UserPromptSubmit `systemMessage` in the UI** ("UserPromptSubmit says: ...") and does not add it to model context. The first run saw nothing shown; a second run confirmed it is shown, so the first observation was a miss.
- **Copilot SessionStart context was inconclusive.** Two consecutive sessions on the same plugin disagreed about whether the context was visible, so the run neither confirms nor rules out delivery. An earlier [SessionStart measurement](copilot-pascalcase-sessionstart-context.md) saw it delivered.

## What each finding changed

- **Key aliasing.** `hook_input` reads a `tool_input.<key>` by its Claude name on both hosts and falls back to the Copilot spelling when the Claude key is null: `file_path` to `path`, `content` to `file_text`, `old_string` to `old_str`, `new_string` to `new_str`. A Claude payload finds its own key first, so the filter stays free of host checks.
- **Raw-input debug line.** With `PLUGINFINITY_HOOK_DEBUG=1` each hook writes its raw input, truncated, to the debug log, so a maintainer sees what a host sends without editing a build.
- **Dogfood crash test.** A bats test runs the crash hook on Copilot's Read shape, since the live run never reached it, and asserts it fails open.
- **The hook-eval skill.** The live checklist became a skill in the dogfood plugin, so a debug session can run it and write a report. Its Copilot and Claude host blocks carry the subagent-prompt, typed-prompt and `systemMessage` notes above.
- **Docs.** The companion's hooks reference teaches the alias table, that `hook_allow` passes `updatedInput` through unchanged, and the host notes above.

## Second run, 2026-10-05

The same checklist, with the companion plugin loaded beside dogfood by the debug scripts and a new Step A for the plugin-engineer agent and its four skills. Hosts were Claude Code 2.1.289 and GitHub Copilot CLI 1.0.91. Both ran in sessions the owner directed, at about the same time, so they shared the two log files and each report attributes only its own host's lines.[^hook-eval-reports-2026-10-05]

- **Hook checks.** Every hook check passed on both hosts, including the Copilot SessionStart context, which was present this time, and the Claude `systemMessage`, which the owner saw.
- **Agent and skills listed.** `pluginfinity:plugin-engineer` and `hook-authoring`, `hook-events`, `plugin-scripts` and `migrating-hooks` were listed on both hosts. On Copilot the `hook-authoring` description ended with the three `paths` globs, as built.
- **Copilot read its skills.** The delegated plugin-engineer named the five skills and said this host does not preload them, so the read-first block works. It quoted the first body line of `hook-authoring`.
- **`paths` does not force-load.** On Claude, reading `plugins/dogfood/hooks/post-edit.sh`, which matches `hook-authoring`'s `**/hooks/**/*.sh`, loaded no skill content and showed no skill indicator. That matches the documented meaning of `paths`, globs that limit automatic activation, not a trigger. The hook-eval A3 expectation said the skill would load, so it was corrected to "available, no automatic injection, invocation recorded", and the skill and agent docs and the plugin-engineer body were reworded to match.
- **Claude's plugin-engineer preload.** Asked what it had preloaded, it named the five skills in its `skills:` list.
- **Observations, inconclusive.** On Claude, Stop ran at each subagent's finish with the parent's session id, which fits a Stop hook that also covers subagent completion, but one run does not establish that. On Copilot, a subagent asked for the first line of its prompt reported its agent header, `# Plugin engineer`, while the raw `UserPromptSubmit` input for that subagent showed the injected `pluginfinity-dogfood subagent context` first. The hook fired and the context is in the event stream; what the model perceives as its prompt's first line is not settled. Neither is acted on.

### Agent dry run

The plugin-engineer was run in a scratch copy of the dogfood plugin and asked to add an `rm -rf` guard. It met all five criteria: the fixture and a failing test came first, a config entry was added, the build ran, bats passed 15 of 15 on both targets, and nothing under `builds/` was edited by hand. `build --check` was clean. The scratch hook had gaps that matter only for that copy, `echo` and `git rm` false positives and misses on `xargs`, `find -delete` and `bash -c`, and prompted no change to the repository.

## What this rules in and out

- The `env` route for the event name works on Copilot, so the library needs no per-event command prefix.
- It covers one machine, one session per check, and the host versions named. The Copilot SessionStart context was present on the second run, so the first run's miss is not repeated, though the earlier disagreement still counts against relying on it. The Claude `systemMessage` result held across three runs.
- `paths` is a hint for Claude and metadata on Copilot, never a loader, so a skill that must be read has to be preloaded, or named in an agent's instructions.
- The agent dry run is one task by one run; it shows the loop is followable, not that it holds for a migration.

[^owner-live-runs]: conversation with the repository owner, 2026-10-03
[^copilot-hooks-reference]: <https://docs.github.com/en/copilot/reference/hooks-configuration>
[^hook-eval-reports-2026-10-05]: `../../.pluginfinity/hook-eval/claude-20261005-1204.md`
