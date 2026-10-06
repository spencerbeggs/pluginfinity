---
type: Decision
title: pluginfinity ships as a carrier package over scoped layer packages
description: The CLI is split into @pluginfinity/core, @pluginfinity/targets, @pluginfinity/engine and @pluginfinity/cli, with the unscoped pluginfinity package as the carrier that owns the bin; only what the carrier exports is supported surface.
status: stable
tags:
  - architecture
  - release
  - deps
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The owner's direction to adopt the carrier pattern under the @pluginfinity scope
  - id: carrier-pattern
    resource: https://github.com/spencerbeggs/effected/tree/main/plugins/claude-code/skills/design-patterns/references
    title: The effected design-patterns skill's carrier package references
generated:
  by: okfit/claude-code
  at: 2026-10-02T19:38:56Z
  body_sha256: 37989e0b843cc8a38d89908165fdfc14aa12379cbb899b92abe14123f2ab53ec
verified:
  - by: human:spencer
    at: 2026-10-06T03:11:19Z
---

# pluginfinity ships as a carrier package over scoped layer packages

## Context

pluginfinity started as one package, `packages/pluginfinity/`, holding the whole CLI ([the application decision](pluginfinity-is-a-cli-application.md)). The repository owner chose to split it before any builder code existed, using the carrier pattern the `@effected/*` kit and its sibling tools already use, so dependencies are divided by layer from the start rather than untangled later.[^owner-direction] The layer packages publish under the `@pluginfinity` npm scope, which the owner registered ([name decision](pluginfinity-name.md)).

## Decision

The workspace has five packages, every dependency edge pointing down:[^carrier-pattern]

```text
pluginfinity (carrier) -> @pluginfinity/cli -> @pluginfinity/engine -> @pluginfinity/targets -> @pluginfinity/core
```

- **`@pluginfinity/core`** is the platform-free domain model: the plugin source model, the `Target` capability schema and the `pluginfinity.config.ts` shape.
- **`@pluginfinity/targets`** holds the host targets (Claude Code, Copilot) as data against core's `Target` schema. It is its own package because host facts change on the hosts' schedule, not core's.
- **`@pluginfinity/engine`** computes everything a front end needs: config discovery, the build pipeline, `check`, and `ENGINE_VERSION`. It reads no `process`.
- **`@pluginfinity/cli`** is the command-line front end. It renders what the engine computes and declares no bin.
- **`pluginfinity`** is the carrier. It is the one package a user installs, the only package that declares a bin, and it passes its own identity down so `--version` reports `via pluginfinity <version>`.

Every package publishes under the `@pluginfinity` scope except the carrier, which takes the unscoped `pluginfinity` name so `npx pluginfinity` works.

The libraries (core, targets, engine) declare `effect` and other runtime companions as peer dependencies. The installed packages (cli and the carrier) declare their full runtime closure as regular dependencies, including names no file under their `src/` imports, because those entries satisfy a library's peer.

The only supported library surface is what the carrier exports, starting with `defineConfig` and the config types for `pluginfinity.config.ts`. The scoped packages are published so the dependency graph installs, with no stability promise to anyone importing them directly.

## Alternatives rejected

- **Keep one package.** It works while there is one front end, but an MCP front end would then pull in the CLI's whole dependency tree, and the split would have to be made later across real code.
- **Create an empty `@pluginfinity/mcp` now.** There is no MCP design yet. Because the engine owns everything a second front end would need, adding one later is a new package plus one carrier shim, with nothing to restructure.
- **Fold targets into core.** Host facts would then force core releases whenever a host's documentation changes.

## Consequences

- An MCP front end is expected later, most likely for the [companion plugin](../modules/pluginfinity-plugin.md) to ask about host capabilities and preview renders. It is not designed.
- The layering and the source boundaries (no `process` outside a front end's `main.ts`, no Node built-ins in core or targets) are pinned by tests rather than by convention.
- The project's non-goal of having no public library API is narrowed to: no supported surface beyond what the carrier exports.

[^owner-direction]: conversation with the repository owner, 2026-10-02
[^carrier-pattern]: <https://github.com/spencerbeggs/effected/tree/main/plugins/claude-code/skills/design-patterns/references>
