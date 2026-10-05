---
"pluginfinity": minor
---

## Features

### MCP and LSP servers

`pluginfinity build` now builds the `mcpServers` a config declares, which used to fail with `NotImplemented`, and a new `lspServers` key, both in Claude Code's server shape. Each target gets its own server files: `.mcp.json` and `.lsp.json` on Claude Code, and `mcp.json` and `com.github.copilot/lsp.json` on GitHub Copilot.

* `${PLUGIN_ROOT}` is rewritten to each host's root variable in a local MCP server's `command`, `args`, `env` values and `cwd`, and in an LSP server's `command`, `args`, `env` values and `workspaceFolder`
* On Copilot every local MCP server is written with `"type": "stdio"`, `http` becomes `streamable-http`, and an LSP server's `extensionToLanguage` is written as `fileExtensions`
* A server under `claude` or `copilot` replaces the base server of the same name on that host
* An MCP `cwd` fails the Claude Code build, because Claude Code ignores it; an LSP `workspaceFolder` or `settings` fails the Copilot build, because Copilot has neither

### Shipped launchers and files

Every file a server names after `${PLUGIN_ROOT}/` now ships with that host's build, and a new base `files` key ships extra files and directories to every target. A named file must exist inside the plugin and be written without `.` or `..` segments, and a file used as a whole `command` must be executable; otherwise the build fails with the new `ShippedFileInvalid` finding.

### Server library

Every target with a local MCP or LSP server gets `lib/pluginfinity/server.sh`, a POSIX `sh` library for launcher scripts, and each such server's `env` gains `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB`. A launcher sources `$PLUGINFINITY_LIB/server.sh` and calls `server_exec_bin <bin> <package>` to run the project's installed binary, falling back to `npx`, with no host branches.

## Breaking Changes

* `lib/pluginfinity/` is now reserved like `hooks/lib/pluginfinity/`: a shipped source file there fails the build with `PathConflict`
* A server `env` key starting with `PLUGINFINITY_` now fails as `ConfigInvalid`
