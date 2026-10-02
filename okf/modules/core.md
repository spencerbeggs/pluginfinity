---
type: Module
title: "@pluginfinity/core"
description: The platform-free pluginfinity domain model; today the plugin-wide config fields and the per-target override shape, later the plugin source model and the Target capability schema.
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
    title: PluginName, BaseConfigFields and TargetSetting
generated:
  by: okfit/claude-code
  at: 2026-10-02T19:34:21Z
  body_sha256: ad6c2078d3935f69a137e11eff3a0e6c5ce179f10b441a0cef0e5ca3b9e717c1
---

# @pluginfinity/core

## What it is

`packages/core/` is the bottom layer of pluginfinity ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).[^package-manifest] It owns the shapes everything else is derived from.

## What it holds today

The plugin-wide half of the [config](../interfaces/config.md):[^config]

- `PluginName`, the kebab-case name every host accepts. The CLI checks `--name` and `plugin add <name>` against it too.
- `BaseConfigFields` and `BASE_CONFIG_KEYS`, the config fields that are not target keys, which today are only `name`. Base keys and target ids share one key space in the config, so a base key must never equal a target id.
- `TargetOverride` and `TargetSetting`, a target key's value: `true`, or an object that may override `name` for that host. `false` is rejected; an absent key means the target is off.

Core does not know which targets exist. [`@pluginfinity/targets`](targets.md) joins these base fields with one key per known target into `PluginfinityConfig`, which the [carrier](pluginfinity.md) exposes through `defineConfig`.

It will also own the host-neutral plugin source model (component kinds and their frontmatter) and the `Target` schema, which describes a host by what it can do. Both are the remaining design work in [the roadmap](../roadmaps/pluginfinity-first-release.md).

## Rules

- It is platform-free: no `process`, no Node built-ins, no `@effect/platform*`. A boundary test pins this. Its `CORE_VERSION` reads `process.env.__PACKAGE_VERSION__` only as a build-time define the bundler replaces.
- As a library it declares `effect` as a peer dependency, with the same name in `devDependencies` for its own tests.

[^package-manifest]: `../../packages/core/package.json`
[^config]: `../../packages/core/src/config.ts`
