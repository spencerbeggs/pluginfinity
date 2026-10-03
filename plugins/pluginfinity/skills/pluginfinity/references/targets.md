# What each host gets

## Layout

| Part | Claude Code (`builds/claude/`) | Copilot (`builds/copilot/`) |
| :-- | :-- | :-- |
| Manifest | `.claude-plugin/plugin.json` | `plugin.json`, Agent Plugins 1.0 |
| Skills | `skills/<name>/` | `skills/<name>/` |
| Agents | `agents/<name>.md` | `com.github.copilot/agents/<name>.agent.md` |
| Hooks file | `hooks/hooks.json` | `com.github.copilot/hooks/hooks.json` |
| Hook scripts | `hooks/` | `hooks/` |
| Plugin root in hooks | `${CLAUDE_PLUGIN_ROOT}` | `${PLUGIN_ROOT}` |

## Skill fields

Claude Code keeps every field. On Copilot:

| Field | Copilot |
| :-- | :-- |
| `name`, `description`, `license`, `argument-hint`, `disable-model-invocation`, `user-invocable` | Kept |
| `when_to_use`, `paths` | Folded into `description` as "Also use when: ..." and "Applies to files matching: ..." |
| `allowed-tools` | Translated, as for agent tools |
| `disallowed-tools`, `arguments`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `shell` | Dropped |
| `compatibility`, `metadata` | Unresolved: Copilot does not document them, so setting one fails on Copilot |

## Agent fields

Claude Code keeps every field except `permissionMode`, `mcpServers`, `hooks` and `initialPrompt`, which
it ignores in plugin agents, so the build drops them. On Copilot:

| Field | Copilot |
| :-- | :-- |
| `name`, `description` | Kept |
| `tools` | Translated to Copilot's aliases; see below |
| `model` | A full model ID is kept; `inherit` is dropped, since Copilot inherits when no model is set; the aliases `sonnet`, `opus`, `haiku` and `fable` are unresolved, so set a model ID under `targets.copilot` |
| `effort` | Written as `reasoningEffort` for `low`, `medium` and `high`; `xhigh` and `max` are unresolved |
| `skills` | Appended to the body as a `## Skills` list |
| `mcpServers` | Unresolved: set `mcp-servers` under `targets.copilot` instead |
| Every other field | Dropped |

Copilot-only agent fields go in `targets.copilot`: `target`, `metadata`, `models`, `modelPolicy`,
`include-custom-instructions`, `disable-model-invocation`, `user-invocable`, `mcp-servers`, `handoffs`,
`argument-hint` and `agents`.

## Tools

On Copilot each Claude Code tool name becomes its documented alias, with duplicates removed:

| Claude Code | Copilot |
| :-- | :-- |
| `Read`, `NotebookRead` | `read` |
| `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | `edit` |
| `Grep`, `Glob` | `search` |
| `Bash`, `PowerShell` | `execute` |
| `WebFetch`, `WebSearch` | `web` |
| `TodoWrite` | `todo` |
| `Agent`, `Task` | `agent` |
| `Skill` | Dropped; Copilot has no alias |
| `mcp__<server>__<tool>` | `<server>/<tool>` |

A rule such as `Bash(git log:*)` on a renamed tool is unresolved: Copilot has no per-command rules, and
dropping the rule would widen the tool, so set the field under `targets.copilot`. Any other name passes
through unchanged; Copilot ignores names it does not recognize. A
`mcp__plugin_...` name belongs to another plugin, whose server name on Copilot is unknown, so it passes
through too.
