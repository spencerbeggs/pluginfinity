---
type: Decision
title: Claude Code's MCP and LSP servers go inline in plugin.json
description: The claude target writes its MCP and LSP servers inline under mcpServers and lspServers in .claude-plugin/plugin.json instead of a root .mcp.json and .lsp.json, because repositories conventionally gitignore .mcp.json and a committed build then ships no MCP server; Copilot keeps its server files.
status: draft
tags:
  - architecture
  - portability
  - dx
sources:
  - id: okfit-request
    resource: okfit round-5 dogfood request mail, 2026-10-06
    title: "okfit's round-5 request: Claude MCP servers belong inside plugin.json"
    last_modified: 2026-10-06T00:00:00Z
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-06T00:00:00Z
    title: The owner's approval to move both server kinds inline for Claude Code
  - id: claude-format
    resource: ../references/claude-code-plugin-format.md
    title: Claude Code plugin format, the mcpServers and lspServers manifest fields
  - id: copilot-format
    resource: ../references/copilot-cli-plugin-format.md
    title: Copilot CLI plugin format, Agent Plugins 1.0 server files
  - id: target
    resource: ../../packages/core/src/target.ts
    title: ServerPlacement, InFile and InManifest
  - id: servers
    resource: ../../packages/engine/src/servers.ts
    title: renderServers and its placement
generated:
  by: okfit/claude-code
  at: 2026-10-06T05:14:30Z
  body_sha256: b9b4c78c5174280e209482e14ae97f0f6e3410b027771d360fe6f41a5f4ae5f8
---

# Claude Code's MCP and LSP servers go inline in plugin.json

## Context

The [target description](../models/target-description.md) had neither manifest name its servers: the claude target wrote a root `.mcp.json` and `.lsp.json`, which Claude Code loads by default. `.mcp.json` is also the conventional name for a developer's local MCP config, and repositories gitignore it. okfit does, so its committed Claude build carried no MCP server: a clean clone or a marketplace install could not resolve the `mcp__plugin_okfit_mcp__*` tools its agents name, and `build --check` failed on every clean checkout with `claude would have added .mcp.json`. Nothing warned about it.[^okfit-request] This repository had worked around the trap for its own plugins with a `.gitignore` negation, which every consumer would have to rediscover.

## Decision

- **Claude Code's servers are inline.** The claude target writes its MCP servers under `mcpServers` and its LSP servers under `lspServers` in `.claude-plugin/plugin.json`, each as the bare name-to-server map, and writes no `.mcp.json` or `.lsp.json`. The server content is unchanged: the root rewritten to `${CLAUDE_PLUGIN_ROOT}`, the injected `PLUGINFINITY_*` env, the `cwd` rule and the LSP field map. Claude Code accepts an inline map keyed by server name in both fields.[^claude-format][^owner-direction]
- **Placement is target data.** `Target.mcp` and `Target.lsp` carry a `placement`: `InFile` with a plugin-relative `path`, or `InManifest` with the manifest `key` and the file it `reserves`, built with `inFile` and `inManifest`. The format literals `claude-mcp-servers` and `claude-lsp-servers` encode the bare map. `renderServers` returns the manifest-placed maps by key, and `renderManifest` writes them through the manifest's key allowlist, after the metadata, `mcpServers` before `lspServers`. A test pins that every manifest-placed key is in that target's allowlist.[^target][^servers]
- **Copilot is unchanged.** Agent Plugins 1.0 forbids those manifest fields, so the copilot target keeps root `mcp.json` and `com.github.copilot/lsp.json` as `InFile` placements.[^copilot-format]
- **The default files are reserved when servers are inline.** Claude Code still loads a root `.mcp.json` and `.lsp.json` beside the manifest's servers, so the claude target's placements reserve them, each only when that build has inline servers of that kind: a plugin with `mcpServers` reserves `.mcp.json`, one with `lspServers` reserves `.lsp.json`. A source file that would ship at a reserved path, whether from `files` or a path a server names, fails the build with `PathConflict` (reason `reserved-server-file`, which tells the author to declare the servers in the config), as a file under `lib/pluginfinity/` does (reason `reserved-dir`). A Claude plugin with no MCP servers that ships its own `.mcp.json` through `files` builds as it always did. Copilot's placements are files and reserve nothing beyond their own generated paths.[^target]
- **A build removes the old files.** A `.mcp.json` or `.lsp.json` an earlier build wrote is not in the plan, so the next build deletes it and `build --check` reports it as removed.

## Alternatives rejected

- **Keep `.mcp.json` and warn when a `.gitignore` excludes it.** The build would need to read the consumer's ignore rules, and the fix would still fall to every consumer.
- **Move only `mcpServers`.** `.lsp.json` is not commonly ignored, but two placements for the claude target's servers would be two rules to remember for no gain.
- **An engine special case for Claude Code.** That breaks [targets are data](targets-are-data-plus-named-formats.md); a placement in the description keeps the engine host-neutral.

## Consequences

- A committed Claude build is complete whatever the repository ignores, and the `!plugins/*/builds/**/.mcp.json` negation in this repository's `.gitignore` is gone.
- A plugin's `plugin.json` changes whenever a server does, so a server edit shows up as a manifest change in `build --check`.
- A plugin that declares MCP servers and also ships its own `.mcp.json` through `files` builds for Copilot but fails for Claude Code with `PathConflict`; move those servers into the config.

[^okfit-request]: okfit round-5 dogfood request mail, 2026-10-06
[^owner-direction]: conversation with the repository owner
[^claude-format]: `../references/claude-code-plugin-format.md`
[^copilot-format]: `../references/copilot-cli-plugin-format.md`
[^target]: `../../packages/core/src/target.ts`
[^servers]: `../../packages/engine/src/servers.ts`
