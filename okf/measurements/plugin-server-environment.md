---
type: Measurement
title: Plugin MCP and LSP server environment on Claude Code and Copilot, 2026-10-05
description: What Claude Code 2.1.288 and GitHub Copilot CLI 1.0.91 give a plugin's MCP and LSP server processes for root variables, working directory and project directory, and which config keys each host accepts, measured with a probe plugin per host.
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
    title: A non-interactive probe run by the implementing agent on the owner's machine under Claude Code 2.1.288 and Copilot CLI 1.0.91
generated:
  by: okfit/claude-code
  at: 2026-10-05T17:22:15Z
  body_sha256: e85b071f508cd770fa7ef1890011f1bb14354d22822c450ba9085819a83264c5
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

[^server-probe-run]: conversation with the repository owner, 2026-10-05
