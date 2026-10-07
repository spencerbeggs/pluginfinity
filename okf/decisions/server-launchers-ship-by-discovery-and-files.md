---
type: Decision
title: Server launchers ship by discovery and files, beside an injected server library
description: A build ships every plugin file a target's MCP and LSP servers name after ${PLUGIN_ROOT}/, plus what the files key lists, and writes a POSIX sh server library to lib/pluginfinity/ with PLUGINFINITY_* variables in each local server's env.
status: stable
tags:
  - architecture
  - portability
  - dx
sources:
  - id: servers-spec
    resource: ../../docs/superpowers/specs/2026-10-05-mcp-lsp-servers-design.md
    title: MCP and LSP servers design spec
    last_modified: 2026-10-05T00:00:00Z
  - id: server-measurement
    resource: ../measurements/plugin-server-environment.md
    title: What each host gives a plugin's MCP and LSP server processes
  - id: servers
    resource: ../../packages/engine/src/servers.ts
    title: renderServers, serverFiles and the injected env
  - id: operations
    resource: ../../packages/engine/src/operations.ts
    title: The shipped-file planner and its checks
  - id: server-lib
    resource: ../../packages/engine/server-lib/server.sh
    title: The server library
generated:
  by: okfit/claude-code
  at: 2026-10-07T06:17:04Z
  body_sha256: a8262330236cd62f0689e37f33381eaca9dc40fa568989ae56ef02b357fab584
verified:
  - by: human:spencer
    at: 2026-10-05T18:45:46Z
---

# Server launchers ship by discovery and files, beside an injected server library

## Context

An MCP or LSP server in a plugin is usually `sh ${PLUGIN_ROOT}/bin/start-*.sh`: a launcher that finds the user's project and execs a binary installed there. Before servers were built, a build shipped only `skills/`, `agents/`, `hooks/` and the scripts a hook names, so a launcher never reached `builds/`. The launcher also has questions only the host can answer, and the hosts answer them differently: Claude sets `CLAUDE_PROJECT_DIR` and starts every server in the project; Copilot starts an MCP server in the plugin root with no project variable at all, and an LSP server at the git root in the one layout measured.[^server-measurement] A launcher that branches on the host repeats the drift the [hook library](hook-library-is-build-injected.md) was built to remove.

## Decision

- **Discovery.** Every `${PLUGIN_ROOT}/<path>` in a target's merged servers ships to that target, read only from the fields the placeholder is documented in: a local MCP server's `command`, `args`, `env` values and `cwd`, and an LSP server's `command`, `args`, `env` values and `workspaceFolder`. A reference ends at whitespace, a quote, a shell metacharacter, `:` or `,`, so a PATH-style or comma-separated list names each path. A reference that names a directory ships every file under it, as a `files` directory entry does. A launcher only one target's override names ships only to that target.[^servers]
- **An explicit list.** The base `files` key ships files and directories (ending in `/`) to every target, for what no server field names, such as data a launcher reads.
- **Strict paths.** A discovered path must be written without empty, `.` or `..` segments (a directory may end in one `/`), exist, and resolve inside the plugin, every file under a named directory included, and a whole `command` must be an executable file, never a directory; otherwise the build fails with `ShippedFileInvalid`. A `files` entry is canonical by schema, and every file under a listed directory is real-path checked the same way. The host resolves the path as written, so a `..` through a directory the build does not ship would fail only at run time.[^operations]
- **An injected library.** A target with a local server gets `lib/pluginfinity/server.sh`, a POSIX `sh` library embedded in the engine like the hook library. It writes nothing to stdout, which carries the protocol, and provides `server_host`, `server_plugin_root`, `server_project_dir`, `server_exec_bin` and `server_log`.[^server-lib]
- **One root spelling.** Only `${PLUGIN_ROOT}` is rewritten. A host's own spelling (`${CLAUDE_PLUGIN_ROOT}`, `${COPILOT_PLUGIN_ROOT}`, either without braces) or a brace-less `$PLUGIN_ROOT` in a root field would pass through unrewritten and ship nothing, so it is a `ComponentInvalid` issue keyed by the server and field, such as `mcpServers.<name>.args`, or `copilot.mcpServers.<name>.args` for a server a target override sets.[^servers]
- **An env contract.** Every local server's `env` gains `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB` (the library directory under the host's root spelling), so a launcher starts with `. "$PLUGINFINITY_LIB/server.sh"`. Author `env` keys starting with `PLUGINFINITY_` are rejected at decode, so the injection never overwrites one.[^servers]
- **`server_project_dir` never guesses the plugin root as the project.** It prints `CLAUDE_PROJECT_DIR` on Claude. When the working directory is the plugin root or under it, as for a Copilot MCP server, it prints nothing and returns 1, and `server_exec_bin` goes straight to `npx --yes <package>`; on Copilot the client offers no roots either, so such a server cannot learn the project (measured 2026-10-07). Otherwise it walks up from `$PWD` to the closest `.git`, and prints `$PWD` when there is none.[^server-lib]
- **Reserved paths.** `lib/pluginfinity/` is reserved in every target whether or not it has servers, as `hooks/lib/pluginfinity/` is; a shipped file there, or on a generated path, is `PathConflict`.

## Alternatives rejected

- **Shipping a fixed directory such as `bin/` whole**: Claude puts a plugin's `bin/` on the Bash tool's `PATH`, so the library cannot live there, and a fixed name forces a layout on every plugin. Discovery ships exactly what a server names.[^servers-spec]
- **Discovery alone**: a launcher can read a file no server field names. **`files` alone**: every author would list each launcher twice, once in the server and once in `files`.
- **Scanning every string in a server**: a remote MCP server, `initializationOptions` or `settings` can hold text that looks like a path, and the host never expands the placeholder there.
- **Per-host launchers, or host branches in one launcher**: two files or two code paths to keep in step, the drift the hook library already removed.

## Consequences

- Authors cannot patch the library; library version equals the pluginfinity version, and `build --check` treats it like any other output.
- Launchers stay `sh` and the plugin carries no Node code, per [plugins carrying no Node dependencies](plugins-carry-no-node-dependencies.md); a Node server runs from the project's `node_modules/.bin` or through `npx`.
- On Copilot an MCP launcher learns no project directory, and the client offers no roots either (measured 2026-10-07), so a Copilot MCP server cannot learn the project at all. The dogfood run on both hosts showed the library falling through to `npx` there.[^server-measurement]
- `server_exec_bin` reports on stderr and does not call `server_log`, so the error log stays empty unless a launcher logs itself.

[^servers-spec]: `../../docs/superpowers/specs/2026-10-05-mcp-lsp-servers-design.md`
[^server-measurement]: `../measurements/plugin-server-environment.md`
[^servers]: `../../packages/engine/src/servers.ts`
[^operations]: `../../packages/engine/src/operations.ts`
[^server-lib]: `../../packages/engine/server-lib/server.sh`
