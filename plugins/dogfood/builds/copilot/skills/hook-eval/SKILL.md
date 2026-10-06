---
name: hook-eval
description: >-
  Run the pluginfinity-dogfood live hook evaluation in a debug session and write a report. Use inside a
  session started with pnpm claude:debug or pnpm copilot:debug, when asked to check that the hook
  library behaves on this host.
---

# Live hook evaluation

You are running a live end-to-end check of pluginfinity's hook library from inside a session that has the `pluginfinity-dogfood` plugin loaded. The plugin's hooks fire on marker strings. Trigger each one, observe what happens to you, ask the user only for what you cannot observe yourself, and write a report.

## Before you start

1. Work out which host you are, Claude Code or GitHub Copilot CLI, and record its version with `claude --version` or `copilot --version`.
2. Ask the user to confirm the session was started with `pnpm claude:debug` or `pnpm copilot:debug`. Those scripts set `PLUGINFINITY_HOOK_DEBUG=1` and load this plugin and the companion pluginfinity plugin. If it was not, say so in the report; the debug-log checks are then skipped.
3. Note the current line count of each log, with `wc -l` or "absent", so you can read only the lines this run adds. They live in `~/.local/state/pluginfinity/pluginfinity-dogfood/` as `hook-error.log` and `hook-debug.log`.

When a step needs a subagent, use `eval-subagent` from this plugin; it carries no other context.

Rules:

- Do the steps in order, one at a time, and record the observed result verbatim next to the expected one.
- Do not edit the repository. Beyond the report, the only files you create are the two marker files in step 4 and the last step, and you delete both.
- If a step needs the user, stop and ask one precise question, such as "Did you see a system message reading ...?"
- If something unexpected happens, record it and carry on. Do not try to fix the plugin.

Copilot notes:

- Type prompts as chat messages. Replies submitted through a form or question tool do not fire UserPromptSubmit.
- Subagent context arrives prepended to the subagent's first prompt. Ask the subagent to quote the first line of its prompt.
- Copilot also fires UserPromptSubmit for the subagent's own prompt, under the subagent's session id. Expect extra debug lines for it.

## Steps

**Step 1. SessionStart context.** Look at the context you received at session start. Did pluginfinity-dogfood inject a line like `pluginfinity-dogfood is loaded on <host> (<source>)`? Quote it exactly, or say it is absent. Expected: present, naming your host. On Copilot this has been seen in one run and missed in another, so report what you see without judging it.

**Step 2. UserPromptSubmit.** Ask the user to send you a message containing `pf-dogfood-system`, typed as a chat message. When it arrives, check the new lines in hook-debug.log.
Expected: nothing shown, and a debug line `hook_system_message does nothing on copilot for UserPromptSubmit`.

**Step 3. PreToolUse deny.** Run the shell command `echo pf-dogfood-deny`. Record whether it was blocked and the exact reason. Expected: blocked, with a reason mentioning `pluginfinity-dogfood denies commands holding pf-dogfood-deny`.

**Step 4. PreToolUse crash fails open.** Run `touch /tmp/pf-dogfood-crash.txt`, then read `/tmp/pf-dogfood-crash.txt` with your file-read tool, not the shell. Record whether the read succeeded, then check the new lines in hook-error.log. Expected: the read succeeds, and the error log gains a line containing `exited 1`.

**Step 5. PostToolUse context.** Run `echo pf-dogfood-context`. Did you receive additional context `pluginfinity-dogfood saw pf-dogfood-context` after the tool result? Quote it. Expected: yes.

**Step 6. SubagentStart context.** Start a subagent with a trivial task, such as "reply with the word ok", using `eval-subagent` from `pluginfinity-dogfood`. Tell it to report back verbatim any context it received that mentions pluginfinity-dogfood.
The injected context is at the top of the subagent's first prompt. Also ask the subagent to quote the first line of its prompt, where the context should appear.
Expected: the subagent quotes `pluginfinity-dogfood subagent context`.

**Step 7. Unexpected errors.** Look at the new lines in hook-error.log since the start, apart from step 4's crash line. Any other line is unexpected; quote it.

**Step 8. Debug log review.** Quote the new hook-debug.log lines from this run, and note which hook functions were no-ops on this host. Each hook run logs an `input:` line holding the raw event the host sent.

**Step 9. Input shape.** From the `input:` lines for the PreToolUse runs in steps 3 and 4, state whether `tool_input` was an object or a string, which key names the Read tool used, and whether `hook_event_name` was present. Do not edit any build to find this out.

**Step A. Agent and skills.** Check the companion plugin's agent and skills, and record each as an extra report row labelled A1 to A4.

A1. List the available agents and confirm `plugin-engineer`, from `pluginfinity`, is listed.

A2. List the available skills and confirm `hook-authoring`, `hook-events`, `plugin-scripts` and `migrating-hooks` are all listed.

A3. The `paths` auto-load.
Record that `paths` auto-loading does not exist on Copilot, and that the skill description carries the globs instead.

A4. Delegate to `plugin-engineer` with "Name the skills you were told to read or have preloaded, and quote the first line of the hook-authoring skill". Record the answer.

**Last step. Stop block.** Do this last. Run `touch "$PWD/.pf-dogfood-block"` in the project root; the hook walks up from the session cwd to the nearest `.git`. Then finish your turn with a one-line answer. The Stop hook should block you once with the reason `pluginfinity-dogfood: delete .pf-dogfood-block, then stop`. If you get that reason, delete the file and finish. If you are not blocked, delete the file anyway and record that. Expected: blocked once.

## Report

Write the report to `.pluginfinity/hook-eval/<host>-<YYYYMMDD-HHMM>.md` in the project root, where `<host>` is `claude` or `copilot` and the stamp is the local time now. Create the directory first with `mkdir -p .pluginfinity/hook-eval`. The directory is git-ignored.

Write the file with your file-write tool, never with a shell heredoc or `echo`. The deny hook matches marker strings in shell commands, so a heredoc that quotes one would be blocked.

Use this shape:

```markdown
# Live hook library run: <host> <version>, <date/time>

Debug enabled: yes/no

| # | Check | Expected | Observed | Pass |
|---|---|---|---|---|
| 1 | SessionStart context | ... | ... | yes/no |
| A1 | plugin-engineer agent listed | ... | ... | yes/no |
| A2 | the four skills listed | ... | ... | yes/no |
| A3 | paths auto-load | hook-authoring available; no automatic injection; invocation recorded | ... | yes/no |
| A4 | plugin-engineer skill answer | ... | ... | yes/no |

## Log excerpts
(the new hook-error.log and hook-debug.log lines from this run, verbatim)

## Anything unexpected
```

When it is written, tell the user the path.

## Body tokens and links

These lines exercise body tokens and plugin links; they are not evaluation steps.

- Read files with view and the dogfood server's echo tool, dogfood-echo.
- Delegate to pluginfinity-dogfood:eval-subagent, or see the helper agent (`pluginfinity-dogfood:eval-subagent`).
- This skill is /pluginfinity-dogfood:hook-eval; shape the report with the report template (the `hook-eval` skill's `references/report-template.md`).
