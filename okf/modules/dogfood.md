---
type: Module
title: dogfood plugin fixture
description: plugins/dogfood, an end-to-end fixture that builds a plugin with the real CLI to exercise features the companion plugin does not use; never released.
kind: harness
resource: ../../plugins/dogfood
status: draft
tags:
  - testing
sources:
  - id: package-manifest
    resource: ../../plugins/dogfood/package.json
    title: dogfood package manifest
  - id: changeset-config
    resource: ../../.changeset/config.json
    title: Changesets config that ignores the fixture
  - id: config
    resource: ../../plugins/dogfood/pluginfinity.config.ts
    title: The fixture's pluginfinity config
  - id: hooks-suite
    resource: ../../plugins/dogfood/__test__/hooks.bats
    title: The bats suite for the fixture's hook scripts
  - id: hook-eval
    resource: ../../plugins/dogfood/skills/hook-eval/SKILL.md
    title: The hook-eval skill
  - id: root-manifest
    resource: ../../package.json
    title: The root manifest, with the claude:debug and copilot:debug scripts and the bats scripts
  - id: e2e
    resource: ../../packages/pluginfinity/__test__/e2e/dogfood.e2e.test.ts
    title: The doctor smoke test that runs inside the fixture
generated:
  by: okfit/claude-code
  at: 2026-10-03T20:49:08Z
  body_sha256: 66b10a069b339f7fb99cb0e8b85065cb883f850f5b527a75da55e119787fff74
---

# dogfood plugin fixture

## What it is

`plugins/dogfood/` is a plugin that exists only to be built by the CLI. The CLI will gain features that the [companion plugin](pluginfinity-plugin.md) has no use for, and dogfood is where those features are exercised end to end, through the real `pluginfinity` bin against a real plugin source.

## Shape

- `package.json` is the private package `@pluginfinity/dogfood-plugin`, ignored by changesets, depending on the CLI as `"pluginfinity": "workspace:*"`.[^package-manifest]
- It is listed under `ignore` in `.changeset/config.json`, so it is never versioned or released.[^changeset-config]
- It is not distributed through any marketplace. It is unrelated to the `plugins/dogfood/` sandbox in the bot repository.

- `pluginfinity.config.ts` is a real config: `name: "pluginfinity-dogfood"` with both `claude` and `copilot` enabled and its hooks declared, imported through `defineConfig` from the workspace carrier.[^config]

## Hooks

Seven scripts under `hooks/` exercise every feature of the [hook library](../decisions/hook-library-is-build-injected.md) on both targets, each firing on a marker string: SessionStart and SubagentStart add context, UserPromptSubmit shows a system message, PreToolUse denies a command holding the deny marker, a second PreToolUse hook on `Read` crashes on purpose to prove the library fails open, PostToolUse adds context, and Stop blocks once while a marker file exists. Each script assigns its input to a variable first, so a failed read aborts and fails open.[^config]

`__test__/hooks.bats` runs the built scripts from `builds/<target>/` through the carrier's [bats helper](pluginfinity.md), with JSON fixtures under `__test__/fixtures/`, including a Copilot-shaped Read for the crash test.[^hooks-suite] `pnpm test:bats` runs it with the engine's library suite, and a build has to be current first.

## Live evaluation

`skills/hook-eval/SKILL.md` is a skill an agent runs inside a debug session to perform the live checklist on that host and write a report to `.pluginfinity/hook-eval/`. It uses host blocks for the checks only one host can do.[^hook-eval] Two root scripts start such a session: `pnpm claude:debug` and `pnpm copilot:debug` load only this plugin's build and set `PLUGINFINITY_HOOK_DEBUG=1`, while plain `pnpm claude` and `pnpm copilot` load the companion. The first run is recorded in [a measurement](../measurements/hook-library-live-2026-10-03.md).[^root-manifest]

## Status

It exercises hooks through the library, with a bats suite and the live evaluation skill, and has no agents and no other skill. A second end-to-end test exercises it too: the carrier's dogfood smoke test runs the built `pluginfinity doctor --agent` inside it and requires its config check to pass.[^e2e] It grows during phase 2 of [the roadmap](../roadmaps/pluginfinity-first-release.md), alongside the builder, one exercised feature at a time.

[^package-manifest]: `../../plugins/dogfood/package.json`
[^changeset-config]: `../../.changeset/config.json`
[^config]: `../../plugins/dogfood/pluginfinity.config.ts`
[^hooks-suite]: `../../plugins/dogfood/__test__/hooks.bats`
[^hook-eval]: `../../plugins/dogfood/skills/hook-eval/SKILL.md`
[^root-manifest]: `../../package.json`
[^e2e]: `../../packages/pluginfinity/__test__/e2e/dogfood.e2e.test.ts`
