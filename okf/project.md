---
type: Project
title: pluginfinity
description: A CLI that builds one host-neutral agent-plugin source into every host's plugin format, and the companion plugin that teaches how to author for it.
status: draft
tags:
  - architecture
  - portability
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: Scope and shape set by the repository owner when the work moved out of the bot repository
generated:
  by: okfit/claude-code
  at: 2026-10-02T19:34:21Z
  body_sha256: 67c217d8fd49b5609f7aad57e17218403b5a828f23cdc7b3e2fe7e16f5709097
---

# pluginfinity

## Purpose

pluginfinity is a command-line tool that takes one host-neutral source for an agent plugin (skills, agents, hooks, MCP wiring and a `pluginfinity.config.ts`) and builds it into a complete, self-contained plugin for each host it targets, starting with Claude Code and GitHub Copilot.[^owner-direction] Today a plugin that ships to several hosts keeps a hand-ported copy per host, and the copies drift. pluginfinity replaces the porting with a build, so per-host differences are either produced mechanically or marked explicitly in one source. The name is settled ([decision](decisions/pluginfinity-name.md)).

This repository also hosts the pluginfinity companion plugin. It knows how to author agent plugins and how to structure them for pluginfinity, and it is the successor to plugin-bot: it covers much of what plugin-bot does, but it is a new plugin, not plugin-bot moved here. plugin-bot stays in the bot repository and its marketplaces, and may keep changing there before pluginfinity ships. The companion is pluginfinity's first real input, so the tool is proven by building its own companion. A second plugin, dogfood, is an end-to-end fixture for the CLI: it exercises features the companion does not need.

## Boundaries

The repository owns:

- The CLI, an application built on `@effected/cli` and Effect v4 ([why an application](decisions/pluginfinity-is-a-cli-application.md)), split into layer packages under `packages/` ([why a carrier](decisions/pluginfinity-ships-as-a-carrier-package.md)): [`@pluginfinity/core`](modules/core.md), [`@pluginfinity/targets`](modules/targets.md), [`@pluginfinity/engine`](modules/engine.md), [`@pluginfinity/cli`](modules/cli.md), and the [`pluginfinity` carrier](modules/pluginfinity.md) that users install.
- `plugins/pluginfinity/`, the [companion plugin](modules/pluginfinity-plugin.md), and `plugins/dogfood/`, the [end-to-end fixture](modules/dogfood.md). Both depend on the `pluginfinity` carrier as a workspace devDependency.
- The host target descriptions: which manifest keys, frontmatter keys, hook events and path conventions each host accepts.

The repository leaves to others:

- **Distribution.** pluginfinity writes plugin folders and does not publish to or edit any marketplace. How the companion plugin itself is distributed is undecided.
- **plugin-bot.** It stays in the bot repository, which owns its source, releases and marketplace entries. Whether it is retired once pluginfinity ships is undecided.
- **Generic building blocks.** Markdown, YAML, JSONC, glob and filesystem handling come from the `@effected/*` kit. A gap found there is fixed upstream, not reimplemented here.

## Non-goals

- Not a package of the `@effected/*` kit. pluginfinity is an application built with the kit ([decision](decisions/pluginfinity-is-a-cli-application.md)).
- No supported library API beyond what the `pluginfinity` carrier exports (`defineConfig` and the config types). The `@pluginfinity/*` packages are published so the dependency graph installs, not as an API for direct import ([decision](decisions/pluginfinity-ships-as-a-carrier-package.md)).
- No versioning beyond copying a plugin's version into each generated manifest. Releasing a plugin belongs to the repository that owns it.
- No round-tripping. Builds flow one way, from source to `builds/<target>/`, and generated output is never edited by hand.

[^owner-direction]: conversation with the repository owner, 2026-10-02
