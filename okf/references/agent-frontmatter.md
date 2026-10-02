---
type: Reference
title: Agent frontmatter across hosts
description: Agent file naming, frontmatter fields, tool vocabularies and plugin restrictions for Claude Code subagents and GitHub Copilot custom agents, side by side.
status: draft
tags:
  - portability
stale_after: 2027-01-01T00:00:00Z
sources:
  - id: claude-code-subagents
    resource: https://code.claude.com/docs/en/sub-agents
    title: Create custom subagents (Claude Code docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: claude-code-plugin-components
    resource: https://code.claude.com/docs/en/plugins/components
    title: Add components to a plugin (Claude Code docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-custom-agents-config
    resource: https://docs.github.com/en/copilot/reference/custom-agents-configuration
    title: Custom agents configuration (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-create-custom-agents
    resource: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents
    title: Creating custom agents for Copilot cloud agent (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-cli-create-custom-agents
    resource: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli
    title: Creating and using custom agents for GitHub Copilot CLI (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-cli-command-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
    title: GitHub Copilot CLI command reference (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-cli-plugin-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
    title: GitHub Copilot CLI plugin reference (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: vscode-custom-agents
    resource: https://code.visualstudio.com/docs/copilot/customization/custom-agents
    title: Custom agents in VS Code
    last_modified: 2026-10-02T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:08:02Z
  body_sha256: 52f0d327ca7483524e27595648c1c4982f5ecc610c69df404fdd363d17a6f6f4
---

# Agent frontmatter across hosts

Unlike skills, agents have no shared open standard: Agent Plugins 1.0 explicitly leaves agents client-specific[^copilot-cli-plugin-reference]. Claude Code calls them subagents[^claude-code-subagents]; GitHub Copilot calls them custom agents, and documents its field set separately for the cloud agent on GitHub.com[^copilot-custom-agents-config], the Copilot CLI[^copilot-cli-command-reference] and VS Code[^vscode-custom-agents].

## File naming and identity

| | Claude Code | Copilot |
| :- | :- | :- |
| File name | `<anything>.md` under `agents/`; the filename does not have to match `name`[^claude-code-subagents] | `<name>.agent.md`; the CLI also accepts `.md`[^copilot-cli-create-custom-agents]. On GitHub.com the filename may contain only `.`, `-`, `_`, `a-z`, `A-Z`, `0-9`[^copilot-create-custom-agents]. VS Code treats any `.md` in `.github/agents` as an agent[^vscode-custom-agents] |
| Identity | The `name` field. Subfolders of `.claude/agents/` and `~/.claude/agents/` do not affect identity[^claude-code-subagents] | CLI: the ID is the path relative to `agents/` minus `.agent.md` or `.md`, with directory separators replaced by `--`, so `agents/team/reviewer.agent.md` is `team--reviewer`. `name` is a display name and does not control deduplication[^copilot-cli-command-reference] |
| Plugin identity | `<plugin>:<name>`, with plugin subfolders joined by `:`, so `agents/review/security.md` is `my-plugin:review:security`; frontmatter `name` replaces only the file-name segment; a file listed in the `agents` manifest key loads without subfolder segments[^claude-code-plugin-components] | Deduplicated by the file-derived ID, e.g. `reviewer.agent.md` is `reviewer`; a project or personal agent with the same ID silently wins over the plugin agent[^copilot-cli-plugin-reference] |
| Project location | `.claude/agents/`, scanned recursively, walking up to the repository root[^claude-code-subagents] | `.github/agents/`, then `.claude/agents/`, each walking up to the Git root[^copilot-cli-command-reference] |
| User location | `~/.claude/agents/`[^claude-code-subagents] | `~/.copilot/agents/`[^copilot-cli-command-reference]; VS Code also reads `~/.claude/agents`[^vscode-custom-agents] |
| Plugin location | `<plugin>/agents/`, recursive; the `agents` manifest key replaces the scan and takes `.md` files only[^claude-code-plugin-components] | Legacy plugins: `agents/` (`.agent.md` files), overridable in the manifest. Agent Plugins 1.0: `com.github.copilot/agents/`[^copilot-cli-plugin-reference] |

Claude Code rejects a `name` containing `:` or starting with `-`[^claude-code-subagents]. A Claude Code plugin agent with no `name`, or frontmatter that does not parse, still loads under its filename[^claude-code-subagents].

## Field table

Copilot column: "cloud" is the GitHub.com reference[^copilot-custom-agents-config], "CLI" is the Copilot CLI reference[^copilot-cli-command-reference], "VS Code" is the VS Code reference[^vscode-custom-agents]. "Not documented" means the source neither lists nor rejects the field.

| Field | Claude Code | Copilot | Notes |
| :- | :- | :- | :- |
| `name` | Required; unique identifier[^claude-code-subagents] | Optional display name; defaults to the filename (cloud) or agent ID (CLI)[^copilot-create-custom-agents][^copilot-cli-command-reference] | Required on Claude Code, optional on Copilot |
| `description` | Required; when Claude should delegate[^claude-code-subagents] | Required[^copilot-custom-agents-config] | |
| `tools` | Comma-separated string or YAML list; omitted inherits all tools available to subagents[^claude-code-subagents] | Comma-separated string or YAML list (cloud); `string[]`, default `["*"]` (CLI); `[]` disables all tools; unrecognized names are ignored[^copilot-custom-agents-config][^copilot-cli-command-reference] | Vocabularies differ; see below |
| `disallowedTools` | Denylist, same format as `tools`[^claude-code-subagents] | Not documented | |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, a full model ID, or `inherit`[^claude-code-subagents] | String; inherits when unset[^copilot-custom-agents-config]. VS Code also accepts a prioritized array[^vscode-custom-agents] | Model names are host-specific |
| `models` | Not documented | CLI: models in priority order; overrides `model`[^copilot-cli-command-reference] | |
| `modelPolicy` | Not documented | CLI: `"preferred"` (default) or `"required"`[^copilot-cli-command-reference] | |
| `effort` | `low`, `medium`, `high`, `xhigh`, `max`[^claude-code-subagents] | Not documented | Copilot CLI's counterpart is `reasoningEffort` |
| `reasoningEffort` | Not documented | CLI: e.g. `"low"`, `"medium"`, `"high"`[^copilot-cli-command-reference] | |
| `permissionMode` | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, `manual`[^claude-code-subagents] | Not documented | |
| `maxTurns` | Max agentic turns[^claude-code-subagents] | Not documented | |
| `skills` | Skills preloaded into context at startup; full content injected[^claude-code-subagents] | Not documented | |
| `mcpServers` | Server names or inline configs[^claude-code-subagents] | Not documented | Claude Code spelling |
| `mcp-servers` | Not documented | Object; same schema as `~/.copilot/mcp-config.json` (CLI); not used in VS Code and other IDEs (cloud)[^copilot-custom-agents-config][^copilot-cli-command-reference] | Copilot spelling; `stdio` maps to the cloud agent's `local` type[^copilot-custom-agents-config] |
| `hooks` | Lifecycle hooks scoped to the subagent[^claude-code-subagents] | VS Code (preview): hooks scoped to the agent, Local harness only[^vscode-custom-agents] | |
| `memory` | `user`, `project`, or `local`[^claude-code-subagents] | Not documented | |
| `background` | `true` keeps the subagent in the background[^claude-code-subagents] | Not documented | |
| `omitClaudeMd` | `true` skips user, project and local CLAUDE.md[^claude-code-subagents] | Not documented | Inverse default of Copilot's `include-custom-instructions` |
| `include-custom-instructions` | Not documented | CLI: include `copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md` when run as a subagent; default `false`[^copilot-cli-command-reference] | |
| `isolation` | `worktree` only[^claude-code-subagents] | Not documented | |
| `color` | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`[^claude-code-subagents] | Not documented | |
| `initialPrompt` | First user turn when run as the main session agent[^claude-code-subagents] | Not documented | |
| `experimental` | Map; only `cacheTtl` (`5m` or `1h`) is read[^claude-code-subagents] | Not documented | |
| `target` | Not documented | `vscode` or `github-copilot`; unset means both[^copilot-custom-agents-config] | |
| `disable-model-invocation` | Not documented for agents | Boolean, default `false`; equivalent to `infer: false` and takes precedence over it[^copilot-custom-agents-config] | Same name as the skill field on both hosts |
| `user-invocable` | Not documented for agents | Boolean, default `true`; `false` means only programmatic access[^copilot-custom-agents-config] | |
| `infer` | Not documented | Retired on cloud[^copilot-custom-agents-config]; deprecated in VS Code[^vscode-custom-agents]; still listed in the CLI table, default `true`[^copilot-cli-command-reference] | |
| `metadata` | Not documented | Cloud: string name/value pairs; not used in VS Code and other IDEs[^copilot-custom-agents-config] | |
| `argument-hint` | Not documented | VS Code only; ignored by the cloud agent[^copilot-custom-agents-config][^vscode-custom-agents] | |
| `handoffs` | Not documented | VS Code only, with `label`, `agent`, `prompt`, `send`, `model`; ignored by the cloud agent[^copilot-custom-agents-config][^vscode-custom-agents] | |
| `agents` | Not documented | VS Code: agent names allowed as subagents; `*` for all, `[]` for none[^vscode-custom-agents] | Claude Code expresses this as `Agent(<type>, ...)` in `tools`, honored only for the main-thread agent[^claude-code-subagents] |

Claude Code field names use camelCase and must match exactly; it ignores an unrecognized field without an error[^claude-code-subagents]. Copilot's treatment of unknown frontmatter fields is not documented; its references say only that unrecognized tool names are ignored[^copilot-custom-agents-config] and that `argument-hint` and `handoffs` are ignored on the cloud agent[^copilot-custom-agents-config].

## Tool vocabularies

Claude Code uses its built-in tool names, for example `Read`, `Grep`, `Glob`, `Bash`, `PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill` and `Agent`[^claude-code-subagents]. `Task` remains an alias for `Agent`. MCP tools use `mcp__<server>` or `mcp__<server>__*`, and `disallowedTools` also accepts `mcp__*`. A specifier such as `Bash(git push *)` in `disallowedTools` removes the whole tool[^claude-code-subagents].

Copilot custom agents accept these case-insensitive aliases[^copilot-custom-agents-config]:

| Primary alias | Compatible aliases | Cloud agent mapping |
| :- | :- | :- |
| `execute` | `shell`, `Bash`, `powershell` | `bash` or `powershell` |
| `read` | `Read`, `NotebookRead` | `view` |
| `edit` | `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | e.g. `str_replace`, `str_replace_editor` |
| `search` | `Grep`, `Glob` | `search` |
| `agent` | `custom-agent`, `Task` | custom agent tools |
| `web` | `WebSearch`, `WebFetch` | not applicable for cloud agent |
| `todo` | `TodoWrite` | not applicable for cloud agent |

So most Claude Code tool names are accepted by Copilot as compatible aliases; the documented gaps are `Agent` (only `Task` is listed), `Skill`, `PowerShell` (only lowercase `powershell` is listed, though aliases are case-insensitive) and Claude's MCP names. Copilot names MCP tools `<server>/<tool>` or `<server>/*`, and `*` grants all tools[^copilot-custom-agents-config]. The Copilot CLI's own tool names are `bash`/`powershell`, `view`, `edit`, `create`, `apply_patch`, `glob`, `grep`, `web_fetch`, `skill`, `task` and others[^copilot-cli-command-reference].

## Restrictions on plugin-shipped agents

Claude Code supports only `name`, `description`, `model`, `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, `omitClaudeMd`, `isolation`, `color` and `experimental.cacheTtl` in plugin agents. It ignores `permissionMode`, `hooks`, `mcpServers` and `initialPrompt`; hooks and MCP servers must ship at the plugin level instead[^claude-code-plugin-components]. The subagents page states the same for `hooks`, `mcpServers` and `permissionMode`, citing security[^claude-code-subagents].

Copilot CLI lets a plugin-shipped agent declare its own `mcp-servers`, and expands `${PLUGIN_ROOT}` (aliases `${CLAUDE_PLUGIN_ROOT}`, `${COPILOT_PLUGIN_ROOT}`) inside that block only. The expansion does not cover `${PLUGIN_DATA}` or the server's environment variables[^copilot-cli-plugin-reference]. No other plugin-agent field restrictions are documented.

## Body semantics

- Claude Code: the body becomes the subagent's system prompt. The subagent gets only that prompt plus basic environment details, not the Claude Code system prompt[^claude-code-subagents].
- Copilot cloud agent: the body defines the agent's behavior and instructions, max 30,000 characters[^copilot-custom-agents-config].
- VS Code: the body is prepended to the user's chat prompt when the agent is selected; it may reference files with Markdown links or `#file:` and tools with `#tool:<tool-name>`[^vscode-custom-agents].

[^claude-code-subagents]: <https://code.claude.com/docs/en/sub-agents>
[^claude-code-plugin-components]: <https://code.claude.com/docs/en/plugins/components>
[^copilot-custom-agents-config]: <https://docs.github.com/en/copilot/reference/custom-agents-configuration>
[^copilot-create-custom-agents]: <https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents>
[^copilot-cli-create-custom-agents]: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli>
[^copilot-cli-command-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference>
[^copilot-cli-plugin-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
[^vscode-custom-agents]: <https://code.visualstudio.com/docs/copilot/customization/custom-agents>
