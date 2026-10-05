---
type: Module
title: "@pluginfinity/core"
description: The platform-free pluginfinity domain model, covering the plugin-wide config fields, hooks, MCP and LSP servers and shipped files, skill and agent frontmatter, and the Target capability schema.
kind: package
layer: core
resource: ../../packages/core
status: draft
tags:
  - architecture
  - portability
sources:
  - id: package-manifest
    resource: ../../packages/core/package.json
    title: "@pluginfinity/core package manifest"
  - id: config
    resource: ../../packages/core/src/config.ts
    title: PluginName, BaseConfigFields and makeTargetSetting
  - id: hooks
    resource: ../../packages/core/src/hooks.ts
    title: Hooks, HookEntry and CLAUDE_HOOK_EVENTS
  - id: mcp
    resource: ../../packages/core/src/mcp.ts
    title: McpServers and ServerEnv
  - id: lsp
    resource: ../../packages/core/src/lsp.ts
    title: LspServer, LspServers and LSP_FIELDS
  - id: frontmatter
    resource: ../../packages/core/src/frontmatter.ts
    title: SkillFrontmatter and AgentFrontmatter
  - id: target
    resource: ../../packages/core/src/target.ts
    title: The Target class and its entries
generated:
  by: okfit/claude-code
  at: 2026-10-05T18:17:00Z
  body_sha256: 7922574eef9086d60819d37304b0bdbf80be7ba25495f6502a2189d6947ac7ae
---

# @pluginfinity/core

## What it is

`packages/core/` is the bottom layer of pluginfinity ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).[^package-manifest] It owns the shapes everything else is derived from.

## What it holds today

The plugin-wide half of the [config](../interfaces/config.md):[^config]

- `PluginName`, the kebab-case name every host accepts. The CLI checks `--name` and `plugin add <name>` against it too.
- `BaseConfigFields` and `BASE_CONFIG_KEYS`, the config fields that are not target keys, which are `name`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `scripts`, `hooks`, `mcpServers`, `lspServers` and `files`. Base keys and target ids share one key space in the config, so a base key must never equal a target id.
- `Hooks`, `HookEntry`, `makeHooks` and `CLAUDE_HOOK_EVENTS`: hooks keyed by Claude Code's 33 event names.[^hooks]
- `ShippedPath`, the canonical plugin-relative path a `files` entry must be: no empty, `.` or `..` segment, not the plugin root, and not under `builds/` or `node_modules/`.
- `McpServers`: MCP servers in Claude Code's `.mcp.json` server shape. `ServerEnv`, the `env` record of MCP and LSP servers, rejects keys starting with `PLUGINFINITY_`, which the build reserves for the variables it injects.[^mcp]
- `LspServer` and `LspServers`: LSP servers in Claude Code's `.lsp.json` server shape, and `LSP_FIELDS`, the list every target's LSP field map must cover.[^lsp]
- `SkillFrontmatter` and `AgentFrontmatter` in Claude Code's field names, with `SKILL_FIELDS` and `AGENT_FIELDS`, the lists every target's field maps must cover.[^frontmatter]
- `Target`, a `Schema.Class` for the [target description](../models/target-description.md), validated at construction by `Target.make`, with an `lsp` part (`path`, a format from `LSP_FORMATS`, and a field map) beside `mcp` and a `pluginRoot.lsp` spelling; its field-map entries (`Keep`, `Rename`, `Translate`, `Degrade`, `Drop`, `Unresolved`) and `Absent` are `Schema.TaggedClass`es, built with the `keep`, `rename`, `translate`, `degrade`, `drop`, `unresolved` and `absent` constructors.[^target]
- `makeTargetSetting`, which builds a target key's value from that target's hooks schema.

Core does not know which targets exist. [`@pluginfinity/targets`](targets.md) joins these base fields with one key per known target into `PluginfinityConfig`, which the [carrier](pluginfinity.md) exposes through `defineConfig`.

The decoded skill and agent models, which hold a body and support files, land with the engine's read stage ([roadmap](../roadmaps/pluginfinity-first-release.md)).

## Rules

- It is platform-free: no `process`, no Node built-ins, no `@effect/platform*`. A boundary test pins this. Its `CORE_VERSION` reads `process.env.__PACKAGE_VERSION__` only as a build-time define the bundler replaces.
- As a library it declares `effect` as a peer dependency, with the same name in `devDependencies` for its own tests.

[^package-manifest]: `../../packages/core/package.json`
[^config]: `../../packages/core/src/config.ts`
[^hooks]: `../../packages/core/src/hooks.ts`
[^mcp]: `../../packages/core/src/mcp.ts`
[^lsp]: `../../packages/core/src/lsp.ts`
[^frontmatter]: `../../packages/core/src/frontmatter.ts`
[^target]: `../../packages/core/src/target.ts`
