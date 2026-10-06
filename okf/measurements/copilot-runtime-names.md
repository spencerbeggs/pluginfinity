---
type: Measurement
title: Copilot CLI run-time tool, skill and agent names, 2026-10-06
description: The names GitHub Copilot CLI 1.0.92 shows a model at run time for its built-in tools, a plugin's MCP tools, a plugin skill and a plugin agent, measured with a throwaway Agent Plugins 1.0 probe plugin, against the frontmatter aliases a target's tool table emits.
tags:
  - portability
status: draft
stale_after: 2027-01-06T00:00:00Z
justifies: ../roadmaps/pluginfinity-first-release.md
sources:
  - id: runtime-names-probe
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-06T00:00:00Z
    title: Probe runs by the implementing agent on the owner's machine under Copilot CLI 1.0.92, using --plugin-dir and --output-format json
generated:
  by: okfit/claude-code
  at: 2026-10-06T01:46:41Z
  body_sha256: 67f760f075c97dde7926f64b1ccef0df33003701edf5c2733d652d61f4181fed
---

# Copilot CLI run-time tool, skill and agent names, 2026-10-06

## Method

A throwaway Agent Plugins 1.0 plugin named `probe` held one skill (`hello`), several agents under `com.github.copilot/agents/` and a stdio MCP server stub (`stubsrv`, one tool `ping_tool`) declared in root `mcp.json`. Copilot CLI 1.0.92 ran non-interactively with `copilot --plugin-dir <dir> --allow-all -p ... --output-format json`, under the model `claude-sonnet-5`. Each check was run once; nothing was repeated, so none of the results has a variance estimate. Two kinds of evidence appear below and every row names which it rests on:

- **Event stream:** the JSONL events `session.skills_loaded`, `session.custom_agents_updated` and `tool.execution_start`, which Copilot itself emitted.
- **Model listing:** the model asked to list its own tool definitions, once for an unrestricted session and once per agent whose `tools` frontmatter held a single alias. This is the model's report, not a Copilot-printed listing.[^runtime-names-probe]

All runs were non-interactive (`-p`); nothing was observed in an interactive session.

## Built-in tools

| Claude Code tool | Frontmatter alias tried | Run-time name the model sees | Evidence |
| :-- | :-- | :-- | :-- |
| Read | `read` | `view` | Model listing |
| Bash | `execute` | `bash`, with `read_bash`, `stop_bash`, `list_bash` | Model listing |
| Edit, Write, MultiEdit | `edit` | `edit` and `create` | Model listing |
| Agent, Task | `agent` | `task`, with `read_agent`, `list_agents`, `write_agent` | Model listing |
| Grep, Glob | `search` | `grep` and `glob` when named literally in `tools`. In one non-interactive (`-p`) run, an agent restricted to the alias `search` was shown no matching tool. The alias's real effect is not established | Model listing |
| WebFetch, WebSearch | `web` | `web_fetch` and `web_search` when named literally in `tools`. In one non-interactive (`-p`) run, an agent restricted to the alias `web` was shown no matching tool. The alias's real effect is not established | Model listing |
| TodoWrite | `todo` | No `todo` or `todo_write` tool appeared in any run. In one non-interactive (`-p`) run, an agent restricted to the alias `todo` was shown no matching tool. The alias's real effect is not established | Model listing |
| Skill | none | `skill`, present in every restricted agent | Model listing; the event stream also showed the model calling `skill` |

Every run-time name in this table, including `sql`, which was present in every restricted agent, rests on the model's own listing, not on a Copilot-printed one. An agent that listed the literal names `grep`, `glob`, `web_fetch` and `web_search` was shown exactly those four, plus `skill` and `sql` (model listing), so the run-time names are accepted in `tools` as well. `todo_write` and the Claude-style `Grep`, `WebFetch` and `TodoWrite` in that same list added nothing visible. The unrestricted session's listing also named `fetch_copilot_cli_documentation`, `run_dynamic_workflow`, `dynamic_workflows_manage` and `session_store_sql`.

## Plugin names

| Thing | Spelling at run time | Evidence |
| :-- | :-- | :-- |
| MCP tool | `{server}-{tool}`, for example `stubsrv-ping_tool`; the event carried `mcpServerName: stubsrv` and `mcpConfigSource: plugin` | Event stream (`tool.execution_start`) |
| Skill command name | `<plugin>:<skill>`, for example `probe:hello` | Event stream (`session.skills_loaded`) |
| Skill tool argument | The bare skill name: the model called `skill` with `{"skill":"hello"}` | Event stream (tool call) |
| Skill invocation by a user | `/probe:hello` ran the skill; `/probe/hello` and `/hello` also reached `skill(hello)`, so a bare name resolved while one skill matched. Observed in `-p` (non-interactive) runs only | Event stream (`skill` tool call) |
| Agent id | `<plugin>:<agent>`, for example `probe:open`; `--agent probe:restricted` selected it | Event stream (`session.custom_agents_updated`) |

An Agent Plugins 1.0 plugin's MCP servers are read only from `mcp.json`; a `.mcp.json` at the plugin root was ignored with an error in the log.

## Not measured

- Whether a bare `/hello` stays unambiguous or fails when two plugins ship a skill of the same name.
- The run-time effect of the aliases `search`, `web` and `todo`, interactive or not; the one non-interactive run per alias showed no matching tool, which does not establish that the alias grants nothing.
- Any interactive-mode behaviour, including skill invocation by a user.
- Tool names under a model other than `claude-sonnet-5`.

[^runtime-names-probe]: conversation with the repository owner
