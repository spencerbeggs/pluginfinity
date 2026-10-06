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
it ignores in plugin agents, so the build drops them and reports each as a `dropped` note for Claude. On
Copilot:

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
| `mcp__plugin_<plugin>_<server>__<tool>`, this plugin's own server | `<server>/<tool>` |

Claude Code names a plugin's MCP tools `mcp__plugin_<plugin>_<server>__<tool>`, so that is how a skill or
agent names a tool of this plugin's own server. `<plugin>` is the plugin's name on Claude Code (the
`claude.name` override, else `name`), and `<server>` must be an MCP server the Copilot build declares
(the base `mcpServers` plus `copilot.mcpServers`). Such a name becomes `<server>/<tool>` on Copilot and is
kept as written on Claude Code. Write it once in the base field; no `targets.copilot` override is needed.

A rule such as `Bash(git log:*)` on a renamed tool is unresolved: Copilot has no per-command rules, and
dropping the rule would widen the tool, so set the field under `targets.copilot`. Any other name is
dropped on Copilot and reported as a `tool-dropped` note: a Claude-only tool such as `ToolSearch`,
`SendMessage` or the `Task` tools, a `mcp__plugin_...` name of another plugin, whose server name on
Copilot is unknown, and one of this plugin's that names a server the Copilot build does not declare.
Claude Code keeps every name as written.

The aliases above come from Copilot's docs. A one-off run showed an agent restricted to `search`, `web`
or `todo` with no matching tool, which does not settle what those aliases grant, so the table is
unchanged until that is measured.

## Run-time names

A `\{{tool …}}`, `\{{agent …}}` or `\{{skill …}}` token in a body writes the name the model sees at run
time, which is not the frontmatter alias. Claude Code writes every name as given. On Copilot:

| Claude Code | Copilot run-time name |
| :-- | :-- |
| `Read` | `view` |
| `Bash` | `bash` |
| `Edit`, `MultiEdit` | `edit` |
| `Write` | `create` |
| `Agent`, `Task` | `task` |
| `Grep`, `Glob` | `grep`, `glob` |
| `WebFetch`, `WebSearch` | `web_fetch`, `web_search` |
| `Skill` | `skill` |
| `TodoWrite`, `NotebookEdit`, `NotebookRead`, `PowerShell` | none measured: the token fails |
| `mcp__plugin_<plugin>_<server>__<tool>`, this plugin's own server | `<server>-<tool>` |
| Any other name, another plugin's MCP tools included | none: the token fails |
| An agent | `<plugin>:<agent>`, also what `copilot --agent` takes |
| A skill | `/<plugin>:<skill>` |

These were measured once, under Copilot CLI 1.0.92 in non-interactive runs; the built-in names rest on
the model's own listing of its tools.

## Notes

Every field a host drops or degrades, every tool it drops and every hook event it omits is reported as an
info-level note under that host's `✓` line, one line per file, with the hooks and servers under `config`
last:

```text
✓ copilot: /work/x/builds/copilot (0 added, 1 changed, 0 removed)
  · agents/x.md: dropped color, maxTurns
  · skills/s/SKILL.md: degraded paths; tool-dropped ToolSearch
  · config: dropped lspServers.md.diagnostics; hook-omitted Setup
```

A value the host's table drops is not reported, since the host does the same without it: `model: inherit`
on Copilot is the one today. See [the findings](findings.md) for the kinds and the JSON form.
