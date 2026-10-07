---
type: Measurement
title: Host runtime probes, 2026-10-07
description: What Claude Code 2.1.292 and GitHub Copilot CLI 1.0.92 showed for CLAUDE_ENV_FILE reach, the skill base-directory line, an MCP server's working directory, environment and client roots, and Copilot's SessionStart source, measured with throwaway dogfood probes, plus the downstream's skill-script environment.
tags:
  - portability
status: draft
stale_after: 2027-01-07T00:00:00Z
justifies: ../decisions/server-launchers-ship-by-discovery-and-files.md
sources:
  - id: probe-runs
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
    title: Live runs by the owner in pnpm claude:debug and pnpm copilot:debug sessions on 2026-10-06 and 2026-10-07, with the round-3 probes (commit f7e553d, since removed) loaded
  - id: systems-findings
    resource: savvy-web/systems round-2 findings, 2026-10-07
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
    title: The downstream's independent measurement of a skill script's environment under Claude Code 2.1.291
  - id: server-measurement
    resource: plugin-server-environment.md
    title: The earlier server environment measurement this one extends
generated:
  by: okfit/claude-code
  at: 2026-10-07T06:19:38Z
  body_sha256: e06b061f73f7ef221496ae42bc2fa5bab392a4779014d2a223a1f23dac7257aa
---

# Host runtime probes, 2026-10-07

## Method

Throwaway probes in the dogfood fixture (commit `f7e553d`, removed afterwards) logged `probe:` lines to `~/.local/state/pluginfinity/pluginfinity-dogfood/debug.log` while the owner ran `pnpm claude:debug` (Claude Code 2.1.292) and `pnpm copilot:debug` (Copilot CLI 1.0.92). Evidence besides the log: the hook-eval report for the Claude run, Claude's session transcript, Copilot's `session-store.db` and its per-session `events.jsonl`.[^probe-runs]

## Results

| # | Observation | Result |
| :-- | :-- | :-- |
| 1 | `CLAUDE_ENV_FILE` in a Claude SessionStart hook | The path is `~/.claude/session-env/<session_id>/sessionstart-hook-<n>.sh`, one file per SessionStart hook run (seen: `sessionstart-hook-1.sh`; the directory also held `sessionstart-hook-6.sh` and silk's `silk-hook.sh`) |
| 1 | Reach of an export appended to it | Reached the Bash tool (the model's shell echoed the value). Did not reach PreToolUse, PostToolUse, Stop, SubagentStart or UserPromptSubmit hooks, which all read it as unset |
| 1 | A separate file written in the same directory | Reached neither later hooks nor the Bash tool |
| 2 | Skill base directory | Both hosts insert `Base directory for this skill: <absolute path>` above the skill body when the skill is invoked: `.../builds/claude/skills/<skill>` on Claude, `.../builds/copilot/skills/<skill>` on Copilot (from `events.jsonl`). Both models read a sibling file from that path without searching |
| 3 | MCP server on Claude | Working directory the project; client capabilities `{"roots":{"listChanged":true},"elicitation":{...}}`; `roots/list` returned the project plus every additional working directory; environment held `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_CODE_SESSION_ID` |
| 3 | MCP server on Copilot | Working directory the plugin root; client capabilities `{"sampling":{},"elicitation":{...}}`, with no `roots`; environment names included `COPILOT_HOME`, `COPILOT_PLUGIN_ROOT`, `COPILOT_PLUGIN_DATA`, `COPILOT_AGENT_SESSION_ID`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `PLUGIN_ROOT`, and no project variable. `INIT_CWD` appeared only because the `pnpm copilot:debug` script launched Copilot, and is absent in a normal launch |
| 4 | Copilot SessionStart `source` for a fresh session | `new`, so a `startup` matcher skipped the hook (`matcher startup did not match new`) |
| 5 | Skill script environment on Claude 2.1.291 (downstream, Bash tool) | Of `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, `CLAUDE_SKILL_DIR`, `CLAUDE_CODE_SESSION_ID` and `CLAUDE_ENV_FILE`, only `CLAUDE_CODE_SESSION_ID` is set, plus whatever SessionStart wrote to `CLAUDE_ENV_FILE`[^systems-findings] |

## What this rules in and out

- A Copilot MCP server cannot learn the project: its working directory is the plugin root, the client offers no roots and no variable names the project. `server_project_dir` returning 1 there is the final answer, not a gap to close.[^server-measurement] A Claude MCP server can read `CLAUDE_PROJECT_DIR`, and the client advertised roots and answered `roots/list`; that was observed through the roots probe, which has since been removed from the fixture.
- Session env written through `CLAUDE_ENV_FILE` reached the Bash tool and no later hook. One sibling file written in the same directory reached neither, and no other file placement was tried. That a hook needs its own file to carry a value is a design consequence of these results, not a separate measurement.
- Both hosts insert the base-directory line, so a skill can find its own files from it. On Claude Code 2.1.291 the downstream measured `CLAUDE_SKILL_DIR` unset in the Bash tool, so a skill script cannot rely on that variable there; how a skill script learns its directory on Copilot was not measured.
- A SessionStart matcher for Copilot must accept `new` as well as `startup`; the build widens `startup` to `startup|new`.
- Not measured: Copilot's hook environment (the probe was skipped by the `startup` matcher), and the dogfood LSP server on Copilot, which failed to start because the fixture then named a package that does not exist. The fixture now ships a working stub.

[^probe-runs]: conversation with the repository owner, 2026-10-07
[^systems-findings]: savvy-web/systems round-2 findings, 2026-10-07
[^server-measurement]: `plugin-server-environment.md`
