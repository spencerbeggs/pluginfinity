# What each host gets

## Layout

| Part | Claude Code (`builds/claude/`) | Copilot (`builds/copilot/`) |
| :-- | :-- | :-- |
| Manifest | `.claude-plugin/plugin.json` | `plugin.json`, Agent Plugins 1.0 |
| Skills | `skills/<name>/` | `skills/<name>/` |
| Agents | `agents/<name>.md` | `com.github.copilot/agents/<name>.agent.md` |
| Hooks file | `hooks/hooks.json` | `com.github.copilot/hooks/hooks.json` |
| Hook scripts | `hooks/` | `hooks/` |
| MCP servers | `.mcp.json` | `mcp.json`, with `$schema` |
| LSP servers | `.lsp.json` | `com.github.copilot/lsp.json` |
| Server library | `lib/pluginfinity/server.sh` | `lib/pluginfinity/server.sh` |
| Plugin root in hooks and servers | `${CLAUDE_PLUGIN_ROOT}` | `${PLUGIN_ROOT}` |

## Servers

A host with no servers of a kind gets no file for it, and only a host with a local server gets the
server library.

| | Claude Code | Copilot |
| :-- | :-- | :-- |
| MCP `type` | As written | `"stdio"` written on every local server (Copilot skips one without it); `http` becomes `streamable-http`; `sse` kept |
| MCP `cwd` | Fails the build: Claude ignores it | Kept, root rewritten |
| LSP `extensionToLanguage` | Kept | Written as `fileExtensions` |
| LSP `startupTimeout`, `shutdownTimeout`, `restartOnCrash`, `maxRestarts`, `diagnostics` | Kept | Dropped |
| LSP `workspaceFolder`, `settings` | Kept | Fail the build; override the server under `copilot.lspServers` |
| Server working directory | The project | MCP: the plugin root. LSP: the git root, in the one layout measured |

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
dropping the rule would widen the tool, so set the field under `targets.copilot`. Any other name is
dropped on Copilot: a Claude-only tool such as `ToolSearch`, `SendMessage` or the `Task` tools, and a
`mcp__plugin_...` name, which belongs to another plugin whose server name on Copilot is unknown. Claude
Code keeps every name as written.
