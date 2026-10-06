---
type: Module
title: pluginfinity companion plugin
description: plugins/pluginfinity, the agent plugin that teaches how to author plugins for pluginfinity; built by pluginfinity and the successor to plugin-bot.
kind: plugin
resource: ../../plugins/pluginfinity
status: draft
tags:
  - portability
  - dx
sources:
  - id: skill
    resource: ../../plugins/pluginfinity/skills/pluginfinity/SKILL.md
    title: The pluginfinity skill
  - id: hooks-reference
    resource: ../../plugins/pluginfinity/skills/pluginfinity/references/hooks.md
    title: The hooks reference
  - id: package-manifest
    resource: ../../plugins/pluginfinity/package.json
    title: Companion plugin tracking package
  - id: plugin-engineer
    resource: ../../plugins/pluginfinity/agents/plugin-engineer.md
    title: The plugin-engineer agent
  - id: recipes-test
    resource: ../../packages/pluginfinity/__test__/recipes.test.ts
    title: The recipe drift test
  - id: migration-table-test
    resource: ../../packages/pluginfinity/__test__/migration-table.test.ts
    title: The migrating-hooks mapping-table completeness test
  - id: plugin-engineer-test
    resource: ../../packages/pluginfinity/__test__/plugin-engineer.test.ts
    title: The plugin-engineer build test
generated:
  by: okfit/claude-code
  at: 2026-10-06T03:16:00Z
  body_sha256: 6353f3abfe0dc30eb61055f10213b66286aa3824e6be74732071b42618fbef60
---

# pluginfinity companion plugin

## What it is

`plugins/pluginfinity/` is the agent plugin that ships alongside the CLI. It will hold the knowledge of how to author agent plugins (manifests, skills, agents, hooks, MCP wiring) and how to structure a plugin source for pluginfinity. It is the successor to plugin-bot and covers much of what plugin-bot does, but it is a new plugin: plugin-bot stays in the bot repository ([decision](../decisions/pluginfinity-is-a-cli-application.md)).

## Shape

- `package.json` is a private tracking package, `@pluginfinity/ai-plugins`, that is never published to npm. A changeset against it bumps its version, which the build copies into each generated manifest, and CI cuts a GitHub-only release that the marketplaces track; `.changeset/config.json` lists both built manifests as its version files.[^package-manifest]
- It depends on the CLI as `"pluginfinity": "workspace:*"` in `devDependencies`, so its scripts run the locally built `pluginfinity`, through `node node_modules/pluginfinity/bin/pluginfinity.js` rather than the bin shim, which a clean install with `--ignore-scripts` never creates. See [the bin-link gotcha](../gotchas/workspace-bin-needs-built-cli.md).
- Once there is a source to build, it follows the target layout in [the roadmap](../roadmaps/pluginfinity-first-release.md): host-neutral source at the root, `pluginfinity.config.ts`, and generated, committed output under `builds/<id>/`.

## Status

The `pluginfinity` skill, the first of five, teaches an agent to author and build a plugin with pluginfinity: the source layout and config, skill and agent frontmatter, `targets` blocks and host blocks, hooks, what each host gets, and every finding with its fix, split into references the skill loads on demand.[^skill] It is built with pluginfinity into `builds/claude/` and `builds/copilot/`, which are committed and skipped by Biome and markdownlint. plugin-bot's host-reference and authoring skills are left for a later release, rewritten for one source.

The hooks reference covers more than declaring hooks: the [hook library](../decisions/hook-library-is-build-injected.md) a script sources and how to read an event and respond on both hosts, with the `tool_input` key aliases and the response table. It also covers what happens when a hook fails, testing hooks with the bats helper, what ships, and which events each host has. It tells authors to assign `hook_input` to a variable first, and to turn on `PLUGINFINITY_HOOK_DEBUG=1` to see each hook's raw input and its outcome.[^hooks-reference]

## The plugin-engineer agent and its skills

`agents/plugin-engineer.md` is an agent that writes, tests and migrates hooks and plugin scripts in a pluginfinity plugin, and converts plugin-bot-era plugins to the hook library. It is declared with `model: inherit`, so it runs on whatever model the session uses. Its loop is bats-first: a fixture, a failing `run_hook` test for both targets, the script, the config entry, a build, then bats green on both targets and a clean `build --check`. It never edits `builds/` and never vendors the library or writes `hooks.json`.[^plugin-engineer]

On Claude Code it preloads five skills through its `skills:` list: `pluginfinity`, `hook-authoring`, `hook-events`, `plugin-scripts` and `migrating-hooks`. Copilot cannot preload skills, so a `pluginfinity:only copilot` block adds a "Read first" section that tells the agent to read the same five before acting. The build test requires the preload list and no read-first block on Claude, and the read-first block on Copilot.[^plugin-engineer-test]

The four skills beside the `pluginfinity` skill are:

- `hook-authoring`: the bats-first loop and the script rules the library depends on, with a `references/recipes.md` of five recipes (command guard, startup context, post-edit reaction, stop gate, subagent context).
- `hook-events`: which event to pick, what each host honours, the input each sends, and the measured host differences, with a `references/events.md`.
- `plugin-scripts`: scripts a plugin ships outside hooks, such as a skill's `scripts/`: finding the plugin root and data directory per host, calling CLIs without leaking credentials, persistent state, the session-env pattern and bats testing.
- `migrating-hooks`: inventories a plugin-bot-era plugin, maps every old helper to its library equivalent in one table, and verifies the result on both hosts.

`hook-authoring` and `plugin-scripts` declare `paths` globs. On Claude those only limit when the skill may be activated automatically; opening a matching file does not load it ([measured](../measurements/hook-library-live-2026-10-03.md)). Copilot has no `paths`, so the build writes the globs into the skill description. The agent body says to read the right skill before touching a hook or script rather than relying on `paths`.

Two tests keep the content from drifting. The recipe drift test ties each recipe in `references/recipes.md` to a real hook in the [dogfood fixture](dogfood.md): the recipe's config entry must appear in dogfood's `pluginfinity.config.ts`, and its script and bats test must match dogfood's byte for byte, so every recipe is already tested on both hosts.[^recipes-test] The migration-table completeness test requires the `migrating-hooks` mapping table to hold a row for each helper plugin-bot's templates defined and its consumers added.[^migration-table-test] Recipe code blocks keep hard tabs, so the repository's markdownlint config sets MD010 with `code_blocks: false`; lint-staged's `--fix` had rewritten the tabs and broken the byte comparison.

## Boundary with dogfood

The companion uses only the CLI features a real plugin needs. CLI features it has no use for are exercised by the [dogfood fixture](dogfood.md) instead, never by adding them to the companion for coverage.

[^package-manifest]: `../../plugins/pluginfinity/package.json`
[^hooks-reference]: `../../plugins/pluginfinity/skills/pluginfinity/references/hooks.md`
[^skill]: `../../plugins/pluginfinity/skills/pluginfinity/SKILL.md`
[^plugin-engineer]: `../../plugins/pluginfinity/agents/plugin-engineer.md`
[^recipes-test]: `../../packages/pluginfinity/__test__/recipes.test.ts`
[^migration-table-test]: `../../packages/pluginfinity/__test__/migration-table.test.ts`
[^plugin-engineer-test]: `../../packages/pluginfinity/__test__/plugin-engineer.test.ts`
