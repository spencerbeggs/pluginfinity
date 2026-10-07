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
  - id: monitors
    resource: ../../packages/core/src/monitors.ts
    title: MonitorEntry, MonitorWhen and Monitors
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
  at: 2026-10-07T07:34:27Z
  body_sha256: 80c91e426ea812d135956f3d8e57cd0616d35639847a5860f96625a94ce6fe70
---

# @pluginfinity/core

## What it is

`packages/core/` is the bottom layer of pluginfinity ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).[^package-manifest] It owns the shapes everything else is derived from.

## What it holds today

The plugin-wide half of the [config](../interfaces/config.md):[^config]

- `PluginName`, the kebab-case name every host accepts. The CLI checks `--name` and `plugin add <name>` against it too.
- `BaseConfigFields` and `BASE_CONFIG_KEYS`, the config fields that are not target keys, which are `name`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `scripts`, `hooks`, `mcpServers`, `lspServers`, `monitors` and `files`. Base keys and target ids share one key space in the config, so a base key must never equal a target id.
- `Hooks`, `HookEntry`, `makeHooks` and `CLAUDE_HOOK_EVENTS`: hooks keyed by Claude Code's 33 event names, where an entry may set `failClosed`.[^hooks]
- `Monitors`, `MonitorEntry`, `MonitorName` and `MonitorWhen`: background monitors keyed by kebab-case name, each a `script` or a `command` with a `description` and an optional `when` (`"always"` or `on-skill-invoke:<skill>` with a bare skill name) ([decision](../decisions/monitors-are-a-component.md)).[^monitors]
- `KebabName`, the one kebab-case schema `PluginName` and `MonitorName` share, and `PluginRelativePath`, the plugin-relative script path hooks and monitors use.
- `ShippedPath`, the canonical plugin-relative path a `files` entry must be: no empty, `.` or `..` segment, not the plugin root, and not under `builds/` or `node_modules/`.
- `McpServers`: MCP servers in Claude Code's `.mcp.json` server shape. `ServerEnv`, the `env` record of MCP and LSP servers, rejects keys starting with `PLUGINFINITY_`, which the build reserves for the variables it injects.[^mcp]
- `LspServer` and `LspServers`: LSP servers in Claude Code's `.lsp.json` server shape, and `LSP_FIELDS`, the list every target's LSP field map must cover.[^lsp]
- `SkillFrontmatter` and `AgentFrontmatter` in Claude Code's field names, with `SKILL_FIELDS` and `AGENT_FIELDS`, the lists every target's field maps must cover.[^frontmatter]
- `Target`, a `Schema.Class` for the [target description](../models/target-description.md), validated at construction by `Target.make`, with an `lsp` part (a `placement`, a format from `LSP_FORMATS`, and a field map) beside `mcp` and a `pluginRoot.lsp` spelling. A placement is a `ServerPlacement`: `InFile` (a plugin-relative `path`) or `InManifest` (a manifest `key` and the file it `reserves`), built with `inFile` and `inManifest`; its field-map entries (`Keep`, `Rename`, `Translate`, `Degrade`, `Drop`, `Unresolved`) and `Absent` are `Schema.TaggedClass`es, built with the `keep`, `rename`, `translate`, `degrade`, `drop`, `unresolved` and `absent` constructors.[^target]
- `makeTargetSetting`, which builds a target key's value from that target's hooks schema. A target's setting may also carry its own `files` and `monitors`.
- `EnvConfig`, `EnvVar` and `EnvVarName`: the `env` block (`vars`, `prefix`, `setup`), with names matching `^[A-Z_][A-Z0-9_]*$`, the reserved names (`PATH`, `IFS`, `HOME`, `PWD`, `XDG_STATE_HOME`, `TMPDIR`, `SHELL`, `BASH_ENV`, `ENV`, `CDPATH`, `SHELLOPTS`, `BASHOPTS`, `PS4`, `PLUGINFINITY_*`, `_PF_*`, `CLAUDE_*`, `COPILOT_*`, `LD_*`, `DYLD_*`) rejected by a struct-level filter so the rule reaches the strict decode's message (a failing `Record` key reports only as an excess property), a default that is one line, and every name checked against the prefix ([decision](../decisions/session-env-is-declared-and-resolved-once.md)). `BaseConfigFields` carries it as `env`.
- In `Target`, `skills.dirSpelling` (`own`, `other`, `agent`) is how `{{skill_dir}}` is spelled, and `hooks.envShell` lists the Claude events from which the host passes a hook's exports to the model's shell.
- In `Target`, the `hooks` part also holds `matcherIgnored` (the Claude events whose matcher the host ignores) and `output` (the events where the host honours a hook's `context` and `system_message`), and a `monitors` part is a `{path, root}` placement or `unresolved`.

Core does not know which targets exist. [`@pluginfinity/targets`](targets.md) joins these base fields with one key per known target into `PluginfinityConfig`, which the [carrier](pluginfinity.md) exposes through `defineConfig`.

The decoded skill and agent models, which hold a body and support files, land with the engine's read stage ([roadmap](../roadmaps/pluginfinity-first-release.md)).

## Rules

- It is platform-free: no `process`, no Node built-ins, no `@effect/platform*`. A boundary test pins this. Its `CORE_VERSION` reads `process.env.__PACKAGE_VERSION__` only as a build-time define the bundler replaces.
- As a library it declares `effect` as a peer dependency, with the same name in `devDependencies` for its own tests.

[^package-manifest]: `../../packages/core/package.json`
[^config]: `../../packages/core/src/config.ts`
[^hooks]: `../../packages/core/src/hooks.ts`
[^mcp]: `../../packages/core/src/mcp.ts`
[^monitors]: `../../packages/core/src/monitors.ts`
[^lsp]: `../../packages/core/src/lsp.ts`
[^frontmatter]: `../../packages/core/src/frontmatter.ts`
[^target]: `../../packages/core/src/target.ts`
