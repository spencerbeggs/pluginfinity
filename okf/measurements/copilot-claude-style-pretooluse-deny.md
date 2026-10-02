---
type: Measurement
title: Copilot honours a Claude-style PreToolUse deny, 2026-10-02
description: A Copilot CLI 1.0.91 plugin hook declared under the PascalCase PreToolUse name, matched on the Claude tool name Bash, received a Claude-shaped payload and blocked the tool with a Claude-shaped deny.
tags:
  - portability
  - github
status: draft
stale_after: 2027-01-01T00:00:00Z
justifies: ../decisions/claude-code-names-are-the-source-vocabulary.md
sources:
  - id: deny-probe-run
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: A run of the pluginfinity-deny-probe plugin under Copilot CLI 1.0.91, made in the session the owner directed
  - id: copilot-hooks-reference
    resource: https://docs.github.com/en/copilot/reference/hooks-configuration
    title: GitHub Copilot hooks configuration reference
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:36:46Z
  body_sha256: 4d00326ec2c341d08ecefccc2391444382a1e7c07a246251f2bd09397bf6ab26
---

# Copilot honours a Claude-style PreToolUse deny, 2026-10-02

## Method

Copilot documents the outputs it honours against its camelCase event names, and says a PascalCase name selects a VS Code compatible payload.[^copilot-hooks-reference] Whether a PascalCase hook's Claude-shaped output is honoured was not stated. A probe plugin in the Agent Plugins 1.0 layout declared one hook in `com.github.copilot/hooks/hooks.json`: event `PreToolUse`, `matcher` `Bash`, `bash` set to `bash "${PLUGIN_ROOT}/hooks/deny.sh"`. The script saved its stdin and printed Claude Code's deny shape, `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"pluginfinity deny probe"}}`. The script file had no executable bit.

Copilot CLI 1.0.91 ran with `--plugin-dir <probe> --allow-all-tools -p` and a prompt asking it to run `echo ran > /tmp/pluginfinity-deny/ran.txt`.[^deny-probe-run]

## Results

- The hook ran, through `bash`, with no executable bit on the script.
- Copilot blocked the shell call and reported `Denied by preToolUse hook: pluginfinity deny probe`. The marker file was never written.
- The payload was Claude-shaped: `hook_event_name` `PreToolUse`, `session_id`, an ISO 8601 `timestamp`, `cwd`, `tool_name` `Bash`, and `tool_input` as an object (`command`, `description`), not a JSON string.[^deny-probe-run]

## What this rules in and out

- A hook declared with Claude Code's event name and tool-name matcher works on Copilot, and one bash script can read the same payload fields and print the same deny on both hosts.
- It covers `PreToolUse` deny only. Other events' outputs under PascalCase names, `ask`, and `modifiedArgs` were not measured.

[^deny-probe-run]: conversation with the repository owner, 2026-10-02
[^copilot-hooks-reference]: <https://docs.github.com/en/copilot/reference/hooks-configuration>
