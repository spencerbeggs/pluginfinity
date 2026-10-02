---
type: Module
title: "@pluginfinity/targets"
description: The hosts pluginfinity builds for (Claude Code as claude, GitHub Copilot as copilot) as a registry, plus the assembled PluginfinityConfig schema; versioned apart from core.
kind: package
layer: targets
resource: ../../packages/targets
status: draft
tags:
  - architecture
  - portability
sources:
  - id: package-manifest
    resource: ../../packages/targets/package.json
    title: "@pluginfinity/targets package manifest"
  - id: registry
    resource: ../../packages/targets/src/registry.ts
    title: The target registry and KNOWN_TARGET_IDS
  - id: config
    resource: ../../packages/targets/src/config.ts
    title: The assembled PluginfinityConfig schema
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:36:46Z
  body_sha256: 88582b050b33c829fca5e4fa7634d23f433b0a959d29c314b192f2d28cab8cc2
---

# @pluginfinity/targets

## What it is

`packages/targets/` holds the hosts pluginfinity builds for, as data.[^package-manifest] It is a separate package because host facts change when a host's documentation changes, not when the domain model does. A corrected host fact is a targets release, not a core release ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).

## What it holds today

- **The registry.** `TARGETS` lists `claude` (Claude Code) and `copilot` (GitHub Copilot), and `KNOWN_TARGET_IDS` lists their ids in registry order. One id names a target everywhere: the config key, `builds/<id>/` and `--target <id>`.[^registry] An entry is only an id and a display name for now.
- **The assembled config.** `PluginfinityConfig` joins [core](core.md)'s base fields with one optional key per target. The target keys are written out by name rather than mapped from the registry, so an editor shows each one, and a test pins them to `KNOWN_TARGET_IDS`. `CONFIG_KEYS` is every legal top-level key, and `enabledTargets` returns the targets a config turns on, in registry order.[^config] The [engine](engine.md) decodes against this schema, and the [carrier](pluginfinity.md)'s `defineConfig` is typed against its encoded form. The promise to plugin authors is the [config interface](../interfaces/config.md).

Adding a host means a registry entry and a config key here, in one release.

## Rules

- It is platform-free, like core: no `process`, no Node built-ins, no `@effect/platform*`.
- A fact the host documentation leaves unresolved is encoded as unresolved, never guessed.

## Status

The capability description of each target (frontmatter keys per component kind, manifest location and keys, plugin-relative path spelling, hook events, missing features such as `paths:` auto-loading) is designed as the [target description](../models/target-description.md) and lands with core's `Target` schema in the builder phase of [the roadmap](../roadmaps/pluginfinity-first-release.md).

[^package-manifest]: `../../packages/targets/package.json`
[^registry]: `../../packages/targets/src/registry.ts`
[^config]: `../../packages/targets/src/config.ts`
