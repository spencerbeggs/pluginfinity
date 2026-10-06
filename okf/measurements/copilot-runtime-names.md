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
  at: 2026-10-06T03:14:59Z
  body_sha256: caacb4211251cbbc5550886791d1d17039c77bf1800d7113a5ce24899ba586f3
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
| Grep, Glob | `search` | `grep` and `glob` when named literally in `tools`. In one non-interactive (`-p`) run, an agent restricted to the alias `search` was shown no matching tool. The alias follow-up below found it grants no tool | Model listing |
| WebFetch, WebSearch | `web` | `web_fetch` and `web_search` when named literally in `tools`. In one non-interactive (`-p`) run, an agent restricted to the alias `web` was shown no matching tool. The alias follow-up below found it grants no tool | Model listing |
| TodoWrite | `todo` | No `todo` or `todo_write` tool appeared in any run. In one non-interactive (`-p`) run, an agent restricted to the alias `todo` was shown no matching tool. The alias follow-up below found it grants no tool | Model listing |
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

## Alias follow-up, 2026-10-06

The first probe left the aliases `search`, `web` and `todo` unestablished: one `-p` run each, resting on the model listing its own tools. This follow-up asks whether an agent restricted to one alias can actually execute a tool, using Copilot's own event stream instead of model prose.

### Alias follow-up method

Copilot CLI 1.0.92. A fresh throwaway Agent Plugins 1.0 plugin `alias` held five agents under `com.github.copilot/agents/`, each with a single-entry `tools` list: `only-search`, `only-web`, `only-todo`, and the controls `only-grep` and `only-read`. Each ran as `copilot --plugin-dir <dir> --allow-all -p <prompt> --agent alias:only-<x> --output-format json` in a directory holding one file containing `PROBE_TOKEN`. The prompt told the agent to call the relevant tool (search the directory for `PROBE_TOKEN` with a grep or glob tool; fetch `https://example.com` with a web fetch tool; write a todo item with a todo tool; read the file). The agent body told it to answer `NO_TOOL` if it had no suitable tool. Evidence is the `toolName` of every `tool.execution_start` event. The stream has a `session.tools_updated` event, but it carries only the model name, so it does not list the agent's tools. Each case ran three times under `claude-sonnet-5`; the three alias cases and the `grep` control ran three more times under `gpt-5-mini`, the only other model that accepted `--model` (`gpt-5`, `gpt-5.1`, `claude-sonnet-4.5` and `claude-opus-4.5` were rejected as unavailable). All runs were non-interactive.

### Alias follow-up results

| Agent `tools` | Tool executed (event stream), `claude-sonnet-5` ×3 | Tool executed (event stream), `gpt-5-mini` ×3 | Verdict |
| :-- | :-- | :-- | :-- |
| `search` | None in 2 runs, answered `NO_TOOL`; `sql` only in 1 run (a no-op `SELECT 1`), then `NO_TOOL` | Only `skill`; no grep or glob | Not granted |
| `web` | None in all 3, answered `NO_TOOL` | Only `skill` in 2 runs, none in 1; no fetch tool, although one run's prose claimed to have fetched the page | Not granted |
| `todo` | `sql` only (`INSERT INTO todos ...`) in all 3 | `sql` only in all 3 | Not granted as a tool; the model keeps todos in `sql`, which every restricted agent has anyway |
| `grep` (control) | `grep` executed in all 3 | `grep` executed in all 3 | Literal name works |
| `read` (control) | `view` executed in all 3 | Not run | Alias works and maps to `view` |

The controls show the method can see a granted tool: `grep` and `read` executed every time. The three aliases never produced a `grep`, `glob`, `web_fetch`, `web_search` or todo-specific tool call. `skill` and `sql` appear regardless of the restriction, as in the first probe.

### Alias follow-up conclusion

In Copilot CLI 1.0.92, in non-interactive runs, the aliases `search` and `web` grant no tool: 6 of 6 runs each executed nothing relevant, against 6 of 6 and 3 of 3 for the working controls. `todo` grants no tool of its own either; todo writes go through `sql`, available to every agent. A target that maps Grep and Glob to `search`, WebFetch and WebSearch to `web`, and TodoWrite to `todo` therefore strips those capabilities from Copilot agents. The literal run-time names `grep`, `glob`, `web_fetch` and `web_search` are accepted in `tools` (first probe, plus `grep` here). Not measured: whether `web_fetch` and `web_search` actually execute when named literally (only the first probe's model listing showed them), interactive mode, and any Copilot version other than 1.0.92. The first-probe rows above stand and are superseded on the alias question by this section.

## Not measured

- Whether a bare `/hello` stays unambiguous or fails when two plugins ship a skill of the same name.
- The run-time effect of the aliases `search`, `web` and `todo` in interactive mode; non-interactive runs are covered in the alias follow-up above.
- Any interactive-mode behaviour, including skill invocation by a user.
- Tool names under a model other than `claude-sonnet-5`.

[^runtime-names-probe]: conversation with the repository owner
