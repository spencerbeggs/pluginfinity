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
  - id: package-manifest
    resource: ../../plugins/pluginfinity/package.json
    title: Companion plugin tracking package
generated:
  by: okfit/claude-code
  at: 2026-10-03T02:10:38Z
  body_sha256: 118c22b5aa5f43f9034a835864473a84ba49c4d5e6c16d7bd985769d92915599
---

# pluginfinity companion plugin

## What it is

`plugins/pluginfinity/` is the agent plugin that ships alongside the CLI. It will hold the knowledge of how to author agent plugins (manifests, skills, agents, hooks, MCP wiring) and how to structure a plugin source for pluginfinity. It is the successor to plugin-bot and covers much of what plugin-bot does, but it is a new plugin: plugin-bot stays in the bot repository ([decision](../decisions/pluginfinity-is-a-cli-application.md)).

## Shape

- `package.json` is a private tracking package, `pluginfinity-plugin`, that is never published to npm. It gives changesets a version to bump, and the build copies that version into each generated manifest.[^package-manifest]
- It depends on the CLI as `"pluginfinity": "workspace:*"` in `devDependencies`, so its scripts run the locally built `pluginfinity`. See [the bin-link gotcha](../gotchas/workspace-bin-needs-built-cli.md).
- Once there is a source to build, it follows the target layout in [the roadmap](../roadmaps/pluginfinity-first-release.md): host-neutral source at the root, `pluginfinity.config.ts`, and generated, committed output under `builds/<id>/`.

## Status

The first release holds one skill, `pluginfinity`, which teaches an agent to author and build a plugin with pluginfinity: the source layout and config, skill and agent frontmatter, `targets` blocks and host blocks, hooks, what each host gets, and every finding with its fix, split into references the skill loads on demand.[^skill] It is built with pluginfinity into `builds/claude/` and `builds/copilot/`, which are committed and skipped by Biome and markdownlint. plugin-bot's host-reference and authoring skills are left for a later release, rewritten for one source.

## Boundary with dogfood

The companion uses only the CLI features a real plugin needs. CLI features it has no use for are exercised by the [dogfood fixture](dogfood.md) instead, never by adding them to the companion for coverage.

[^package-manifest]: `../../plugins/pluginfinity/package.json`
[^skill]: `../../plugins/pluginfinity/skills/pluginfinity/SKILL.md`
