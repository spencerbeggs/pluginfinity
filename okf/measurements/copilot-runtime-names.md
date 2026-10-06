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
  at: 2026-10-06T01:44:03Z
  body_sha256: 1945ce72e075f3568097ef8efcbe23f3c414d1ee6ac726946e2448e6393371d9
---

# Copilot CLI run-time tool, skill and agent names, 2026-10-06

## Method

A throwaway Agent Plugins 1.0 plugin named `probe` held one skill (`hello`), several agents under `com.github.copilot/agents/` and a stdio MCP server stub (`stubsrv`, one tool `ping_tool`) declared in root `mcp.json`. Copilot CLI 1.0.92 ran non-interactively with `copilot --plugin-dir <dir> --allow-all -p ... --output-format json`, so the JSONL event stream (`session.skills_loaded`, `session.custom_agents_updated`, `tool.execution_start`) is the evidence for skill, agent and MCP names. Built-in tool names rest on the model listing its own tool definitions, once for an unrestricted session and once per agent whose `tools` frontmatter held a single alias; that evidence is the model's report, not a Copilot-printed listing.[^runtime-names-probe]

## Built-in tools

| Claude Code tool | Copilot frontmatter alias | Run-time name the model sees |
| :-- | :-- | :-- |
| Read | `read` | `view` |
| Bash | `execute` | `bash`, with `read_bash`, `stop_bash`, `list_bash` |
| Edit, Write, MultiEdit | `edit` | `edit` and `create` |
| Agent, Task | `agent` | `task`, with `read_agent`, `list_agents`, `write_agent` |
| Grep, Glob | `search` | `grep` and `glob` by their run-time names; the alias `search` alone exposed neither |
| WebFetch, WebSearch | `web` | `web_fetch` and `web_search` by their run-time names; the alias `web` alone exposed neither |
| TodoWrite | `todo` | No `todo` or `todo_write` tool appeared in any session; `sql` is always present |
| Skill | none | `skill`, always present |

An agent restricted to a single alias still saw `skill` and `sql`. An agent that listed the literal names `grep`, `glob`, `web_fetch` and `web_search` saw exactly those four, plus `skill` and `sql`, so the run-time names are accepted in `tools` as well. `todo_write` and the Claude-style `Grep`, `WebFetch` and `TodoWrite` in that same list added nothing visible. The unrestricted session also listed `fetch_copilot_cli_documentation`, `run_dynamic_workflow`, `dynamic_workflows_manage` and `session_store_sql`.

## Plugin names

| Thing | Spelling at run time |
| :-- | :-- |
| MCP tool | `{server}-{tool}`, for example `stubsrv-ping_tool`; the event carried `mcpServerName: stubsrv` and `mcpConfigSource: plugin` |
| Skill command name | `<plugin>:<skill>`, for example `probe:hello`, from `session.skills_loaded` |
| Skill tool argument | The bare skill name: the model called `skill` with `{"skill":"hello"}` |
| Skill invocation by a user | `/probe:hello` ran the skill; `/probe/hello` and `/hello` also reached `skill(hello)`, so a bare name resolves while one skill matches |
| Agent id | `<plugin>:<agent>`, for example `probe:open`, from `session.custom_agents_updated`; `--agent probe:restricted` selected it |

An Agent Plugins 1.0 plugin's MCP servers are read only from `mcp.json`; a `.mcp.json` at the plugin root was ignored with an error in the log.

## Not measured

- Whether a bare `/hello` stays unambiguous or fails when two plugins ship a skill of the same name.
- The run-time effect of the aliases `search`, `web` and `todo` in interactive mode; the non-interactive agent runs exposed no tool for them.
- Tool names under a model other than `claude-sonnet-5`.

[^runtime-names-probe]: conversation with the repository owner
