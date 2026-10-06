---
type: Decision
title: pluginfinity is a CLI application in its own repository
description: The single-source plugin builder ships as a standalone @effected/cli application with a companion plugin that succeeds plugin-bot, not as an @effected kit package developed inside the bot marketplace repository.
status: stable
tags:
  - architecture
  - release
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The owner's revision of the 2026-09-30 plan
  - id: bot-roadmap
    resource: https://github.com/spencerbeggs/bot/blob/270cbf6c4cbdabf34ada7412b5c40e3e017c685a/okf/roadmaps/single-source-plugin-builds.md
    title: The bot repository's single-source plugin builds roadmap, as planned on 2026-09-30
  - id: bot-project
    resource: https://github.com/spencerbeggs/bot/blob/270cbf6c4cbdabf34ada7412b5c40e3e017c685a/okf/project.md
    title: The bot repository's project concept, with its no-npm-packages non-goal
generated:
  by: okfit/claude-code
  at: 2026-10-02T19:38:56Z
  body_sha256: 84252e0d88241936dac6e91f88aed1633f5f4da4ab47fc39a5e034b3fdbfa340
verified:
  - by: human:spencer
    at: 2026-10-06T03:11:19Z
---

# pluginfinity is a CLI application in its own repository

## Context

The first plan, made in the bot repository on 2026-09-30, was a library named `@effected/ai-bundler`, developed under `packages/ai-bundler/` in that repository and extracted once a second plugin repository adopted it.[^bot-roadmap] On 2026-10-02 the repository owner revised it: the builder is an application built with the `@effected/*` kit, not a member of it, and it should not live in the bot repository, whose marketplace stays as it is.[^owner-direction] The bot repository also lists npm-published packages as a non-goal.[^bot-project]

## Decision

- pluginfinity is a command-line application built on `@effected/cli` and Effect v4, published to npm as its own package.
- It lives in its own repository, `spencerbeggs/pluginfinity`, which started from the pnpm module template.
- pluginfinity has a companion plugin, `plugins/pluginfinity/`, that teaches how to author plugins for pluginfinity and is the first plugin pluginfinity builds. It succeeds plugin-bot and covers much of what plugin-bot does, but plugin-bot itself does not move: it stays in the bot repository and its marketplaces, and may keep changing there.
- The move happened before any builder code was written, because nothing yet had to be extracted.

## Alternatives rejected

- **An `@effected/ai-bundler` kit package.** The builder is one product with one command surface. Kit packages are reusable building blocks, and nothing here has a second consumer yet.
- **Develop in the bot repository, extract later.** Building there would add npm publishing and a build pipeline to a repository whose job is to develop plugins and serve a marketplace, only to remove them again at extraction.
- **Move plugin-bot here as the companion.** It would tie plugin-bot's releases and marketplace entries to pluginfinity's development before pluginfinity ships. A successor lets plugin-bot keep shipping from the bot repository in the meantime.

## Consequences

- The bot repository and its marketplaces are unchanged by this decision. Whether plugin-bot is removed from them after pluginfinity ships is undecided.
- For a while, plugin-authoring guidance exists in two places: plugin-bot in the bot repository and the companion here. The companion draws on plugin-bot's content, which is not kept in sync automatically.
- The companion needs its own release and distribution flow, which is not designed yet; see [the roadmap](../roadmaps/pluginfinity-first-release.md).
- The application is itself split into layer packages under one carrier; see [the carrier decision](pluginfinity-ships-as-a-carrier-package.md). That split divides dependencies, and does not make the layers a supported library API.

[^owner-direction]: conversation with the repository owner, 2026-10-02
[^bot-roadmap]: <https://github.com/spencerbeggs/bot/blob/270cbf6c4cbdabf34ada7412b5c40e3e017c685a/okf/roadmaps/single-source-plugin-builds.md>
[^bot-project]: <https://github.com/spencerbeggs/bot/blob/270cbf6c4cbdabf34ada7412b5c40e3e017c685a/okf/project.md>
