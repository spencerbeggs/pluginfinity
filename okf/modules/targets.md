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
  - id: claude
    resource: ../../packages/targets/src/claude.ts
    title: The CLAUDE description
  - id: copilot
    resource: ../../packages/targets/src/copilot.ts
    title: The COPILOT description
generated:
  by: okfit/claude-code
  at: 2026-10-06T21:43:13Z
  body_sha256: 5ae5fab3a50c0e311b6d566936705cff2d67403904be173f9dfcc05b567eec55
---

# @pluginfinity/targets

## What it is

`packages/targets/` holds the hosts pluginfinity builds for, as data.[^package-manifest] It is a separate package because host facts change when a host's documentation changes, not when the domain model does. A corrected host fact is a targets release, not a core release ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).

## What it holds today

- **The registry.** `TARGETS` lists `claude` (Claude Code) and `copilot` (GitHub Copilot), and `KNOWN_TARGET_IDS` lists their ids in registry order. One id names a target everywhere: the config key, `builds/<id>/` and `--target <id>`.[^registry] Each entry also carries the host's description: `CLAUDE` and `COPILOT`, values of core's `Target` schema.[^claude][^copilot]
- **The assembled config.** `PluginfinityConfig` joins [core](core.md)'s base fields with one optional key per target. The target keys are written out by name rather than mapped from the registry, so an editor shows each one, and a test pins them to `KNOWN_TARGET_IDS`. `CONFIG_KEYS` is every legal top-level key, and `enabledTargets` returns the targets a config turns on, in registry order.[^config] The [engine](engine.md) decodes against this schema, and the [carrier](pluginfinity.md)'s `defineConfig` is typed against its encoded form. The promise to plugin authors is the [config interface](../interfaces/config.md).

- **Run-time names.** Each description carries the names a model sees at run time, which body tokens write: `tools.runtime`, `agents.id` and `skills.invoke`. Claude Code's are its own names, `mcp__plugin_{plugin}_{server}__{tool}`, `{plugin}:{agent}` and `/{plugin}:{skill}`. Copilot's come from [the run-time names measurement](../measurements/copilot-runtime-names.md): `view`, `bash`, `edit`, `create`, `task`, `grep`, `glob`, `web_fetch`, `web_search` and `skill`, the MCP spelling `{server}-{tool}`, `{plugin}:{agent}` and `/{plugin}:{skill}`, with `TodoWrite`, the notebook tools and `PowerShell` unresolved and any unlisted name unresolved.[^claude][^copilot] The built-in names rest on the model's own listing in one non-interactive run.
- **Frontmatter names follow the measurement.** Copilot's `tools.names` writes `grep`, `glob`, `web_fetch` and `web_search` by their literal names, because agents restricted to the documented aliases `search`, `web` or `todo` executed no tool (0/6 each, two models) while the literal names executed 6/6 ([alias follow-up](../measurements/copilot-runtime-names.md)). `TodoWrite` is dropped with a `tool-dropped` note, as is `Skill`; `read`, `edit`, `execute` and `agent` stay as documented.

- **Hook facts.** Each description's `hooks` part lists `matcherIgnored`, the Claude events whose matcher the host ignores (Copilot: `SessionStart`, `SessionEnd`, `SubagentStop`; Claude Code: none), and `output`, the events where the host honours a hook's `context` and `system_message` (Copilot honours no system message). The `output` lists mirror `hook_supports` in the engine's hook library, and a test pins the two together. See [the entry-env decision](../decisions/entry-facts-travel-as-env.md).
- **Monitors.** Claude Code's `monitors` placement is `monitors/monitors.json` with the `${CLAUDE_PLUGIN_ROOT}` spelling; Copilot's is unresolved, because Copilot CLI has no monitors ([decision](../decisions/monitors-are-a-component.md)). The assembled config also takes a target-level `files` and `monitors`.

Adding a host means a registry entry and a config key here, in one release.

## Rules

- It is platform-free, like core: no `process`, no Node built-ins, no `@effect/platform*`.
- A fact the host documentation leaves unresolved is encoded as unresolved, never guessed.

## Status

The descriptions are complete for the first release's component kinds. A test pins that every field map covers every core frontmatter field and every event table covers every Claude Code event.

[^package-manifest]: `../../packages/targets/package.json`
[^registry]: `../../packages/targets/src/registry.ts`
[^config]: `../../packages/targets/src/config.ts`
[^claude]: `../../packages/targets/src/claude.ts`
[^copilot]: `../../packages/targets/src/copilot.ts`
