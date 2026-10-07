---
type: Measurement
title: Plugin MCP and LSP server environment on Claude Code and Copilot, 2026-10-05
description: What Claude Code 2.1.288 and GitHub Copilot CLI 1.0.91 give a plugin's MCP and LSP server processes for root variables, working directory and project directory, and which config keys each host accepts, measured with a probe plugin per host, then run against the built dogfood plugin's launchers (Claude Code 2.1.289 in that second run).
tags:
  - portability
status: draft
stale_after: 2027-01-05T00:00:00Z
justifies: ../roadmaps/pluginfinity-first-release.md
sources:
  - id: server-probe-run
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-05T00:00:00Z
    title: Probe runs by the implementing agent on the owner's machine, first non-interactive under Claude Code 2.1.288 and Copilot CLI 1.0.91, then the dogfood builds under Claude Code 2.1.289 (non-interactive and an interactive tmux session) and Copilot CLI 1.0.91
generated:
  by: okfit/claude-code
  at: 2026-10-07T06:17:04Z
  body_sha256: efcd9296d05fe524937cf545d1b05ccedc6de2a038c5c7e9bf1acd61f9ed1a4f
---

# Plugin MCP and LSP server environment on Claude Code and Copilot, 2026-10-05

## Method

A launcher script wrote its argv, working directory and environment to a file, then idled on stdin. One throwaway probe plugin per host declared it as an MCP server and as an LSP server, with the plugin root in `args`, in `env` (`PROBE_ROOT`) and, for Claude, in `cwd`. Claude Code 2.1.288 ran `claude -p` with `--plugin-dir` from a subdirectory of a throwaway git repository. Copilot CLI 1.0.91 ran after `copilot plugin install <dir>`, also from that subdirectory, and the probe was uninstalled afterwards.[^server-probe-run]

## Results

| Observation | Claude Code | Copilot CLI |
| :-- | :-- | :-- |
| Root variable in MCP `args` and `env` | `${CLAUDE_PLUGIN_ROOT}` expanded | `${PLUGIN_ROOT}` expanded |
| Root variable in LSP `args` and `env` | `${CLAUDE_PLUGIN_ROOT}` expanded | `${PLUGIN_ROOT}` expanded |
| MCP `cwd` key | Ignored: with `${CLAUDE_PLUGIN_ROOT}` and with a literal absolute path alike, the server started in the project directory | `${PLUGIN_ROOT}` expanded; with no `cwd` the default is the plugin root as well |
| MCP server cwd | The session's project directory, the subdirectory `claude` ran from | The plugin root |
| LSP server cwd | The session's project directory, the subdirectory `claude` ran from | The git repository root, one level above the subdirectory `copilot` ran from; observed in a single repository layout, so the rule is not established |
| Variables in the server environment | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR` (the project directory) | `PLUGIN_ROOT`, `COPILOT_PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`, plus the matching `*_DATA` variables and `COPILOT_AGENT_SESSION_ID`; no project-directory variable |
| `${CLAUDE_PROJECT_DIR}` in `env` | Expanded to the project directory, in MCP and LSP | Left as literal text |
| `type` on an MCP server | Not used by the probe | `"type":"stdio"` accepted; a server without `type` was not loaded and never spawned |
| LSP extension map | `extensionToLanguage` accepted | `fileExtensions` accepted; `extensionToLanguage` rejected with `fileExtensions is required` and no server configured |
| LSP file discovery | A root `.lsp.json` was picked up with no manifest key | `com.github.copilot/lsp.json` picked up; spawned when the model used the LSP tool |

## What this rules in and out

- A server command reaches its own files with the host's root variable in `args` or `env` on both hosts, so an encoder must write `${CLAUDE_PLUGIN_ROOT}` for Claude and `${PLUGIN_ROOT}` for Copilot.
- Claude ignores a plugin MCP server's `cwd` outright (variable or literal), so a Claude server needing the plugin root must take it from `args` or `env`; on Copilot an MCP server already starts there.
- A Copilot server cannot be told the project directory by variable; an MCP server's cwd is the plugin root, an LSP server's was the git repository root in the one layout tried.
- A Copilot MCP entry must carry `type`, and a Copilot LSP entry must use `fileExtensions`; an encoder emitting the Claude shape to Copilot loses the server without a warning for MCP.
- `command` was always `sh`, so root-variable substitution in `command` was not exercised on either host. The Claude LSP probe hung on the failed handshake and was killed after its environment file was written. It covers a direct local-path Copilot install and `--plugin-dir` on Claude. It does not cover a marketplace install, Windows, or a server completing the protocol handshake. An LSP server on Copilot ran only once the model used the LSP tool.

## Dogfood build run, 2026-10-05

The same two hosts then ran the committed dogfood builds (`plugins/dogfood/builds/claude` and `plugins/dogfood/builds/copilot`), whose launchers `bin/start-mcp.sh` and `bin/start-lsp.sh` source `lib/pluginfinity/server.sh` and call `server_exec_bin`. The npm packages `@pluginfinity/dogfood-mcp` and `@pluginfinity/dogfood-lsp` do not exist, so a throwaway git project held executable stubs at `node_modules/.bin/dogfood-mcp` and `dogfood-lsp`. Each stub appended its argv, working directory and `PLUGINFINITY_*` and project variables to a file, then ran `exec cat >/dev/null` to stay alive. No stub completes the protocol, so a failed handshake is expected; the evidence is that the host spawned launcher, then library, then the project's stub.[^server-probe-run]

| Host and server | Spawned | Resolved to | Observed |
| :-- | :-- | :-- | :-- |
| Claude Code 2.1.289, LSP | Yes, on the LSP tool's first use of `x.dogfood` | The project stub | `argv=--stdio`, cwd the project, `CLAUDE_PROJECT_DIR` the project, `PLUGINFINITY_HOST=claude`; the initialize request never answered, so the tool call hung until killed |
| Claude Code 2.1.289, MCP | Only after `/mcp` Reconnect | The project stub | `argv` empty, `PLUGINFINITY_HOST=claude`, cwd the project, `CLAUDE_PROJECT_DIR` the project; the connection then timed out after 30000ms |
| Copilot CLI 1.0.91, LSP | Yes, when the model used the LSP tool | The project stub | `argv=--stdio`, cwd the project (also the git root), `PLUGIN_ROOT` and `PLUGINFINITY_LIB` under the installed copy, no `CLAUDE_PROJECT_DIR`; initialize timed out after 60000ms |
| Copilot CLI 1.0.91, MCP | Yes, at session start | `npx --yes @pluginfinity/dogfood-mcp`, not the stub | The library printed `no project directory is known, so dogfood-mcp cannot be looked up in node_modules` and the `Falling back` line on stderr; npm answered E404; the process exited 1 and Copilot logged `MCP server process exited before completing the MCP initialize handshake (exit code 1)` |

- Claude never auto-started the plugin MCP server from `--plugin-dir`. `claude -p` listed no plugin MCP server at all (neither this plugin's nor any installed plugin's), and the interactive `/mcp` list showed `plugin:pluginfinity-dogfood:dogfood` as failed with no spawn and no debug-log line, both before and after the folder-trust prompt. Choosing Reconnect there spawned the launcher. The cause was not established.
- Copilot's MCP launcher most likely ran with the plugin root as its working directory (inferred from the earlier probe; this run did not record cwd, since the stub never ran). It had no project variable (inferred from the library's `no project directory is known` message), so `server_project_dir` returned nothing and the library went to `npx`. That a published package would start the server on this route is untested. Copilot's own MCP log carried the library's stderr, and `copilot mcp list` showed only `dogfood (local)` with no status.
- The library's error log `~/.local/state/pluginfinity/pluginfinity-dogfood/server-error.log` was never created: `server_exec_bin` reports on stderr and does not call `server_log`. That directory held only the hook logs.
- Copilot's installed copy of a local-directory install lives under `~/.config/copilot/installed-plugins/_direct/copilot`. The plugin was uninstalled afterwards; `copilot plugin list` and `copilot mcp list` no longer show it.
- Finding on 2026-10-07 (Claude Code 2.1.292, Copilot CLI 1.0.92): a Copilot MCP server's client offers no `roots` and the environment has no project variable, so the project cannot be learned there; Claude's client offers roots and `CLAUDE_PROJECT_DIR`. See [the host runtime probes](host-runtime-probes-2026-10-07.md).
- Not measured: a server that completes the handshake, a marketplace install, Windows, and a Claude MCP server starting without Reconnect.

[^server-probe-run]: conversation with the repository owner, 2026-10-05
