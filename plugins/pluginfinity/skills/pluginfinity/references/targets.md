# What each host gets

## Layout

| Part | Claude Code (`builds/claude/`) | Copilot (`builds/copilot/`) |
| :-- | :-- | :-- |
| Manifest | `.claude-plugin/plugin.json` | `plugin.json`, Agent Plugins 1.0 |
| Skills | `skills/<name>/` | `skills/<name>/` |
| Agents | `agents/<name>.md` | `com.github.copilot/agents/<name>.agent.md` |
| Hooks file | `hooks/hooks.json` | `com.github.copilot/hooks/hooks.json` |
| Hook scripts | `hooks/` | `hooks/` |
| MCP servers | `mcpServers` in `.claude-plugin/plugin.json` | `mcp.json`, with `$schema` |
| LSP servers | `lspServers` in `.claude-plugin/plugin.json` | `com.github.copilot/lsp.json` |
| Server library | `lib/pluginfinity/server.sh` | `lib/pluginfinity/server.sh` |
| Monitors file | `monitors/monitors.json` | none: Copilot CLI has no monitors |
| Plugin root in hooks, servers and monitors | `${CLAUDE_PLUGIN_ROOT}` | `${PLUGIN_ROOT}` |
| Shared libraries | `lib/pluginfinity/` (`host.sh`, `log.sh`, `server.sh`, `monitor.sh`) and `hooks/lib/pluginfinity/` | the same, without `monitor.sh` |
| Session env | `lib/pluginfinity/env.sh` and `env-run.sh`, and the runner first under `SessionStart`, when the config declares `env` | the same |
| A skill's own directory in its body | `${CLAUDE_SKILL_DIR}`, expanded by the host | `<skill base directory>`, filled in by the model |

## Servers

Claude Code's servers go inline in its `plugin.json`, never in a root `.mcp.json` or `.lsp.json`, so a
`.gitignore` that excludes `.mcp.json` cannot leave a committed build without its MCP server. A build
deletes a `.mcp.json` or `.lsp.json` an older pluginfinity wrote; commit the deletion. A host with no
servers of a kind gets no key or file for it, and only a host with a local server gets the server library.

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

On Copilot each Claude Code tool name becomes the name Copilot grants, with duplicates removed:

| Claude Code | Copilot |
| :-- | :-- |
| `Read`, `NotebookRead` | `read` |
| `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | `edit` |
| `Grep` | `grep` |
| `Glob` | `glob` |
| `Bash`, `PowerShell` | `execute` |
| `WebFetch` | `web_fetch` |
| `WebSearch` | `web_search` |
| `TodoWrite` | Dropped; no name grants it |
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

Measured on Copilot CLI: an agent restricted to the documented aliases `search`, `web` or `todo` executed
no tool (0 of 6 runs each, two models), while the literal `grep`, `glob`, `web_fetch` and `web_search`
executed in every run. So those four are written by name, and `TodoWrite` is dropped with a `tool-dropped`
note. `read`, `edit`, `execute` and `agent` are the documented aliases and are kept.

## Files per host

The base `files` ships to every host. A target's own `files`, `copilot: { files: ["copilot-only/"] }`,
ships to that host only. A file or directory that one host reads, and the other never opens, goes there.

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

In the agent and skill rows `<plugin>` is the plugin's Copilot name, the `copilot.name` override, else
`name`.

`\{{skill_dir}}` is not a run-time name: Copilot gets the placeholder `<skill base directory>`, and
`<skill base directory>/../<skill>` for another skill, which the model resolves from the base-directory line
above the skill body. See [skill directories](components.md#skill-directories).

A tool token can carry a fallback, `\{{tool <name> | <text>}}`: on a host where the tool has a run-time
name, the token is that name and the text is discarded; where it has none, the text replaces the token
instead of failing the build. The text is literal prose, trimmed, and may be neither empty nor contain `{`
or `}`. Only a tool token takes one; `agent`, `skill` and `plugin_root` fail with a fallback.

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

Besides the three above, a build can list these kinds, in this order within a file:

- `hook-matcher-runtime`: the host ignores an event's `matcher` (Copilot on `SessionStart`, `SessionEnd`
  and `SubagentStop`), so the hook library applies it at run time. Only a `script` entry that sources
  `hook.sh` is enforced; see [hooks](hooks.md#matchers-a-host-ignores).
- `hook-output-ignored`: a script calls `hook_context` or `hook_system_message` on an event where the host
  discards that output. The scan is best effort.
- `monitor-omitted`: the host has no monitors, so the monitor was left out.
- `env-shell-unsupported`: the host passes no session env to the model's shell (Copilot), so a skill script
  sources `env.sh`. See [session env](session-env.md).
- `env-wait-timeout`: a `SessionStart` entry's `timeout` is under 5 seconds, less than a reader may wait for
  the env runner plus headroom.
- `hook-matcher-widened`: Copilot calls a fresh session's source `new` where Claude Code says `startup`, so a
  `SessionStart` matcher list holding `startup` gains `new` there: `startup|resume` becomes
  `startup|new|resume`. A list that already holds `new`, an empty or `*` matcher and one without `startup`
  stay as written.
- `hook-matcher-regex`: a `SessionStart` regex matcher matches `startup` but not `new`, and is left as written.

A value the host's table drops is not reported, since the host does the same without it: `model: inherit`
on Copilot is the one today. See [the findings](findings.md) for the kinds and the JSON form.
