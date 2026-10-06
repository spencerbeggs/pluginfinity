---
"pluginfinity": minor
---

## Features

### bats helper for testing built hooks

The package now ships `bats/pluginfinity.bash`, a bats helper for testing a plugin's built hooks. It provides `run_hook`, a set of assert functions and `hook_fixture`, so hook tests can feed fixture input to a built hook and assert on its output and exit status.

### Host-neutral bash hook library

`pluginfinity build` now injects a bash hook library, `hook.sh`, plus a generated `host.sh` into `hooks/lib/pluginfinity/` of every target that has hooks. Hook scripts source it to read hook input and emit decisions the same way on Claude Code and GitHub Copilot.

* Setting `PLUGINFINITY_HOOK_DEBUG=1` logs each hook's raw input and one `outcome:` line per hook exit to a plaintext debug log
* Copilot hook entries now carry `env: { PLUGINFINITY_EVENT: <event> }`

### MCP and LSP servers

`pluginfinity build` now builds the `mcpServers` a config declares, which used to fail with `NotImplemented`, and a new `lspServers` key, both in Claude Code's server shape. Each target gets its own server files: `.mcp.json` and `.lsp.json` on Claude Code, and `mcp.json` and `com.github.copilot/lsp.json` on GitHub Copilot.

* `${PLUGIN_ROOT}` is rewritten to each host's root variable in a local MCP server's `command`, `args`, `env` values and `cwd`, and in an LSP server's `command`, `args`, `env` values and `workspaceFolder`
* A host's own spelling there, such as `${CLAUDE_PLUGIN_ROOT}`, or a brace-less `$PLUGIN_ROOT`, fails the build instead of shipping nothing; write `${PLUGIN_ROOT}`
* On Copilot every local MCP server is written with `"type": "stdio"`, `http` becomes `streamable-http`, and an LSP server's `extensionToLanguage` is written as `fileExtensions`
* A server under `claude` or `copilot` replaces the base server of the same name on that host
* An MCP `cwd` fails the Claude Code build, because Claude Code ignores it; an LSP `workspaceFolder` or `settings` fails the Copilot build, because Copilot has neither

### Shipped launchers and files

Every file a server names after `${PLUGIN_ROOT}/` now ships with that host's build, and a named directory ships every file under it. A reference ends at `:` and `,` too, so `PATH: "${PLUGIN_ROOT}/bin:/usr/bin"` ships `bin/`. A new base `files` key ships extra files and directories to every target. A named path must exist inside the plugin and be written without `.` or `..` segments, and a path used as a whole `command` must be an executable file, not a directory; otherwise the build fails with the new `ShippedFileInvalid` finding.

### Server library

Every target with a local MCP or LSP server gets `lib/pluginfinity/server.sh`, a POSIX `sh` library for launcher scripts, and each such server's `env` gains `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB`. A launcher sources `$PLUGINFINITY_LIB/server.sh` and calls `server_exec_bin <bin> <package>` to run the project's installed binary, falling back to `npx`, with no host branches.

### Build notes

`pluginfinity build`, `build --check` and `validate` now list, under each target's `✓` line, what that host dropped, degraded or omitted, one line per source file:

```text
✓ copilot: /work/plugins/x/builds/copilot (0 added, 1 changed, 0 removed)
  · agents/x.md: dropped color, maxTurns
  · skills/s/SKILL.md: degraded paths; tool-dropped ToolSearch
  · config: dropped lspServers.md.diagnostics; hook-omitted Setup
```

Under `--agent` or `--ci`, each build and validation carries a `notes` array of `{ path, kind, name }`. Notes never change the exit code.

### A plugin's own MCP tools on Copilot

A skill or agent can now name its own plugin's MCP tools as Claude Code does, `mcp__plugin_<plugin>_<server>__<tool>`, and the Copilot build writes `<server>/<tool>` instead of dropping them.

### Body tokens and pluginfinity links

A skill or agent body can name a tool, an agent, a skill or the plugin root once and get each host's spelling:

| Write | Claude Code | Copilot |
| :-- | :-- | :-- |
| `{{tool Read}}` | `Read` | `view` |
| `{{tool mcp__plugin_<plugin>_<server>__<tool>}}` | as written | `<server>-<tool>` |
| `{{agent <agent>}}` | `<plugin>:<agent>` | `<plugin>:<agent>` |
| `{{skill <skill>}}` | `/<plugin>:<skill>` | `/<plugin>:<skill>` |
| `{{plugin_root}}` | `${CLAUDE_PLUGIN_ROOT}` | fails the build |

In an agent id or skill command `<plugin>` is the plugin's name on that host, so a `copilot.name` override shows on Copilot; in an MCP tool name, as in the `{{tool}}` MCP row, it is the Claude Code name on both hosts. Tokens are replaced everywhere, code included, in `SKILL.md`, every other `.md` file in a skill directory and agent bodies. Only those four kinds are tokens, so GitHub Actions `${{ }}`, Jinja and Handlebars pass through, and `\{{` keeps a token literal. A token a host cannot spell fails the build with its file, line and host, and the finding's hint says to put that passage in a host block or write `\{{`.

Inline `[text](pluginfinity://skill/<skill>[/<path>][#anchor])` and `[text](pluginfinity://agent/<agent>)` links are now built: a link under `${CLAUDE_PLUGIN_ROOT}` on Claude Code, prose on Copilot. Any other `pluginfinity://` outside code still fails the build.

### Hook and server library helpers

* `hook_cd_project` in the hook library changes into the user's project before a hook runs a project-aware CLI
* `server_exec_bin` takes `--install <package>` after its two arguments to name a different package in the "not installed" hint

## Bug Fixes

* `build --check` now compares a file's content and, for a file copied from the source, only its executable bit, so a generated file turned executable by a git hook, or a copied file whose other permission bits differ, no longer reports `BuildStale`; a copied file whose executable bit differs from its source still does
* A hook script only one target runs no longer ships to another target when a run builds that target alone, so `build --check --target <id>` agrees with a full build

## Breaking Changes

* `lib/pluginfinity/` is now reserved like `hooks/lib/pluginfinity/`: a shipped source file there fails the build with `PathConflict`
* A server `env` key starting with `PLUGINFINITY_` now fails as `ConfigInvalid`
* A body that already holds `{{tool …}}`, `{{agent …}}`, `{{skill …}}` or `{{plugin_root}}` text is now rendered as a token; write `\{{` to keep it literal
* A template variable that starts with a token kind, such as `{{ tool }}` or `{{ skill.name }}`, is now read as a token and fails the build; write `\{{` to keep it literal
* A malformed token of a known kind, such as an unclosed `{{tool Read` or `{{agent}}` with no name, now fails the build instead of shipping as text
* `{{tool mcp__<server>__<tool>}}` naming a third-party MCP server fails the Copilot build: Copilot has no run-time name for another server's tools, so put the passage in a Claude Code host block
* A plugin source file at or under `hooks/lib/pluginfinity/` is now reported as a `PathConflict`, because that path is owned by the build
* Every target with hooks gains `hooks/lib/pluginfinity/{hook.sh,host.sh}`, so existing builds drift on upgrade; rebuild to refresh them
* `host.sh` stamps the engine version, so every pluginfinity upgrade needs a rebuild, and `pluginfinity build --check` reports the library as drift until then
