---
type: Module
title: "@pluginfinity/core"
description: The platform-free pluginfinity domain model, covering the plugin-wide config fields, hooks and MCP servers, skill and agent frontmatter, and the Target capability schema.
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
    title: McpServers
  - id: frontmatter
    resource: ../../packages/core/src/frontmatter.ts
    title: SkillFrontmatter and AgentFrontmatter
  - id: target
    resource: ../../packages/core/src/target.ts
    title: The Target class and its entries
generated:
  by: okfit/claude-code
  at: 2026-10-02T23:32:29Z
  body_sha256: b90905ffa6c598238a67c2e780eab3dcc0bb7c4889b2bfd478083cfb7af4abf5
---

# @pluginfinity/core

## What it is

`packages/core/` is the bottom layer of pluginfinity ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).[^package-manifest] It owns the shapes everything else is derived from.

## What it holds today

The plugin-wide half of the [config](../interfaces/config.md):[^config]

- `PluginName`, the kebab-case name every host accepts. The CLI checks `--name` and `plugin add <name>` against it too.
- `BaseConfigFields` and `BASE_CONFIG_KEYS`, the config fields that are not target keys, which are `name`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `scripts`, `hooks` and `mcpServers`. Base keys and target ids share one key space in the config, so a base key must never equal a target id.
- `Hooks`, `HookEntry`, `makeHooks` and `CLAUDE_HOOK_EVENTS`: hooks keyed by Claude Code's 33 event names.[^hooks]
- `McpServers`: MCP servers in Claude Code's `.mcp.json` server shape.[^mcp]
- `SkillFrontmatter` and `AgentFrontmatter` in Claude Code's field names, with `SKILL_FIELDS` and `AGENT_FIELDS`, the lists every target's field maps must cover.[^frontmatter]
- `Target`, a `Schema.Class` for the [target description](../models/target-description.md), validated at construction by `Target.make`; its field-map entries (`Keep`, `Rename`, `Translate`, `Degrade`, `Drop`, `Unresolved`) and `Absent` are `Schema.TaggedClass`es, built with the `keep`, `rename`, `translate`, `degrade`, `drop`, `unresolved` and `absent` constructors.[^target]
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
[^frontmatter]: `../../packages/core/src/frontmatter.ts`
[^target]: `../../packages/core/src/target.ts`
