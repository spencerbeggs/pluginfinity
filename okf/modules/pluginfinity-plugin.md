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
generated:
  by: okfit/claude-code
  at: 2026-10-03T20:49:08Z
  body_sha256: d2abdf5666998b9bad61d02d7f432e6fdf7f35431a8fa6a416ea599f96ccc9ea
---

# pluginfinity companion plugin

## What it is

`plugins/pluginfinity/` is the agent plugin that ships alongside the CLI. It will hold the knowledge of how to author agent plugins (manifests, skills, agents, hooks, MCP wiring) and how to structure a plugin source for pluginfinity. It is the successor to plugin-bot and covers much of what plugin-bot does, but it is a new plugin: plugin-bot stays in the bot repository ([decision](../decisions/pluginfinity-is-a-cli-application.md)).

## Shape

- `package.json` is a private tracking package, `@pluginfinity/ai-plugins`, that is never published to npm. A changeset against it bumps its version, which the build copies into each generated manifest, and CI cuts a GitHub-only release that the marketplaces track; `.changeset/config.json` lists both built manifests as its version files.[^package-manifest]
- It depends on the CLI as `"pluginfinity": "workspace:*"` in `devDependencies`, so its scripts run the locally built `pluginfinity`, through `node node_modules/pluginfinity/bin/pluginfinity.js` rather than the bin shim, which a clean install with `--ignore-scripts` never creates. See [the bin-link gotcha](../gotchas/workspace-bin-needs-built-cli.md).
- Once there is a source to build, it follows the target layout in [the roadmap](../roadmaps/pluginfinity-first-release.md): host-neutral source at the root, `pluginfinity.config.ts`, and generated, committed output under `builds/<id>/`.

## Status

The first release holds one skill, `pluginfinity`, which teaches an agent to author and build a plugin with pluginfinity: the source layout and config, skill and agent frontmatter, `targets` blocks and host blocks, hooks, what each host gets, and every finding with its fix, split into references the skill loads on demand.[^skill] It is built with pluginfinity into `builds/claude/` and `builds/copilot/`, which are committed and skipped by Biome and markdownlint. plugin-bot's host-reference and authoring skills are left for a later release, rewritten for one source.

The hooks reference covers more than declaring hooks: the [hook library](../decisions/hook-library-is-build-injected.md) a script sources and how to read an event and respond on both hosts, with the `tool_input` key aliases and the response table. It also covers what happens when a hook fails, testing hooks with the bats helper, what ships, and which events each host has. It tells authors to assign `hook_input` to a variable first, and to turn on `PLUGINFINITY_HOOK_DEBUG=1` to see each hook's raw input.[^hooks-reference]

## Boundary with dogfood

The companion uses only the CLI features a real plugin needs. CLI features it has no use for are exercised by the [dogfood fixture](dogfood.md) instead, never by adding them to the companion for coverage.

[^package-manifest]: `../../plugins/pluginfinity/package.json`
[^hooks-reference]: `../../plugins/pluginfinity/skills/pluginfinity/references/hooks.md`
[^skill]: `../../plugins/pluginfinity/skills/pluginfinity/SKILL.md`
