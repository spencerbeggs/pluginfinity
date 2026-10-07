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
  - id: eval-subagent
    resource: ../../plugins/dogfood/agents/eval-subagent.md
    title: The neutral eval-subagent agent
  - id: post-edit
    resource: ../../plugins/dogfood/hooks/post-edit.sh
    title: The post-edit hook script
  - id: root-manifest
    resource: ../../package.json
    title: The root manifest, with the claude:debug and copilot:debug scripts and the bats scripts
  - id: e2e
    resource: ../../packages/pluginfinity/__test__/e2e/dogfood.e2e.test.ts
    title: The doctor smoke test that runs inside the fixture
generated:
  by: okfit/claude-code
  at: 2026-10-07T02:45:11Z
  body_sha256: 615f3fc953327701a6eaf44ca91cd7aa7e9beeebde1a01388bd710c91c505919
---

# dogfood plugin fixture

## What it is

`plugins/dogfood/` is a plugin that exists only to be built by the CLI. The CLI will gain features that the [companion plugin](pluginfinity-plugin.md) has no use for, and dogfood is where those features are exercised end to end, through the real `pluginfinity` bin against a real plugin source.

## Shape

- `package.json` is the private package `@pluginfinity/dogfood-plugin`, ignored by changesets, depending on the CLI as `"pluginfinity": "workspace:*"`.[^package-manifest]
- It is listed under `ignore` in `.changeset/config.json`, so it is never versioned or released.[^changeset-config]
- It is not distributed through any marketplace. It is unrelated to the `plugins/dogfood/` sandbox in the bot repository.

- `pluginfinity.config.ts` is a real config: `name: "pluginfinity-dogfood"` with both `claude` and `copilot` enabled, its hooks declared (the Bash `PreToolUse` guard sets `failClosed`), two monitors and a shipped `share/` directory, plus a Copilot-only `files` entry (`copilot-only/`), imported through `defineConfig` from the workspace carrier.[^config]

## Hooks

Eight scripts under `hooks/` exercise every feature of the [hook library](../decisions/hook-library-is-build-injected.md) on both targets, each firing on a marker string: SessionStart and SubagentStart add context, UserPromptSubmit shows a system message, PreToolUse denies a command holding the deny marker, a second PreToolUse hook on `Read` crashes on purpose to prove the library fails open, PostToolUse adds context, a PostToolUse hook on `Edit|Write` reads the edited path and adds context naming it, and Stop blocks once while a marker file exists. Each script assigns its input to a variable first, so a failed read aborts and fails open.[^config]

`__test__/hooks.bats` runs the built scripts from `builds/<target>/` through the carrier's [bats helper](pluginfinity.md), with JSON fixtures under `__test__/fixtures/`, including a Copilot-shaped Read for the crash test.[^hooks-suite] The post-edit hook (`hooks/post-edit.sh`) reads `tool_input.file_path`, which the library aliases to Copilot's `path`, so its test covers both input shapes on both targets; it is also the source of the post-edit recipe in the [companion plugin](pluginfinity-plugin.md).[^post-edit] `pnpm test:bats` runs it with the engine's library suite, and a build has to be current first.

## Monitors and logging

Two monitors under `monitors/` exercise the [monitor library](../decisions/monitors-are-a-component.md): `heartbeat` notifies once per session, and `skill-watch` starts with `when: on-skill-invoke:hook-eval`, which the build writes as `on-skill-invoke:pluginfinity-dogfood:hook-eval`, and notifies once. `__test__/monitors.bats` runs them through the bats helper's `run_monitor`, and `hooks.bats` covers `failClosed`, run-time matchers and the Copilot tool names through `run_hook`, and `servers.bats` stubs `pnpm`, `yarn`, `bun`, `bunx` and `npx` on a controlled `PATH` so a launcher test can never start a real server. The scripts log through the [shared log library](../decisions/one-logging-standard.md). A [live run](../measurements/claude-monitor-environment.md) measured a Claude monitor's working directory and environment, and showed `skill-watch` starts only under the qualified skill name, on a slash command or a model dispatch; a downstream measurement of the monitor environment agrees.

## Live evaluation

`skills/hook-eval/SKILL.md` is a skill an agent runs inside a debug session to perform the live checklist on that host and write a report to `.pluginfinity/hook-eval/`. It uses host blocks for the checks only one host can do.[^hook-eval] Two root scripts start such a session: `pnpm claude:debug` and `pnpm copilot:debug` load both this plugin's build and the companion plugin's build, and set `PLUGINFINITY_DEBUG=1`, while plain `pnpm claude` and `pnpm copilot` load only the companion. Both runs are recorded in [a measurement](../measurements/hook-library-live-2026-10-03.md).[^root-manifest]

Where a step needs a subagent, hook-eval delegates to `eval-subagent`, a neutral agent (`tools: Read, Bash`, `model: inherit`, no skills preloaded or listed) whose only context is what the hooks inject, so a quoted prompt or context shows hook output and nothing else. It is for hook-eval runs only, and a build test checks it builds to both hosts without skills.[^eval-subagent]

hook-eval's Step A checks the companion plugin, which the debug scripts now load: A1 that the `plugin-engineer` agent is listed, A2 that the four hook and script skills are listed, A3 the `paths` behaviour (on Claude, read a file matching `hook-authoring`'s globs and record whether the skill was invoked; the expectation is no automatic injection, and on Copilot the globs sit in the skill description), and A4 that `plugin-engineer` is delegated to and names its skills.

## Status

It exercises hooks through the library, with a bats suite and the live evaluation skill, and has one other agent, `eval-subagent`, and no other skill. A second end-to-end test exercises it too: the carrier's dogfood smoke test runs the built `pluginfinity doctor --agent` inside it and requires its config check to pass.[^e2e] It grows during phase 2 of [the roadmap](../roadmaps/pluginfinity-first-release.md), alongside the builder, one exercised feature at a time.

[^package-manifest]: `../../plugins/dogfood/package.json`
[^changeset-config]: `../../.changeset/config.json`
[^config]: `../../plugins/dogfood/pluginfinity.config.ts`
[^hooks-suite]: `../../plugins/dogfood/__test__/hooks.bats`
[^hook-eval]: `../../plugins/dogfood/skills/hook-eval/SKILL.md`
[^eval-subagent]: `../../plugins/dogfood/agents/eval-subagent.md`
[^post-edit]: `../../plugins/dogfood/hooks/post-edit.sh`
[^root-manifest]: `../../package.json`
[^e2e]: `../../packages/pluginfinity/__test__/e2e/dogfood.e2e.test.ts`
