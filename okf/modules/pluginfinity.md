---
type: Module
title: pluginfinity carrier package
description: The unscoped pluginfinity package users install; it owns the pluginfinity bin as a thin shim over @pluginfinity/cli and exports defineConfig, typed against the targets registry, for pluginfinity.config.ts.
kind: package
layer: carrier
resource: ../../packages/pluginfinity
status: draft
tags:
  - architecture
  - release
sources:
  - id: package-manifest
    resource: ../../packages/pluginfinity/package.json
    title: pluginfinity carrier package manifest
  - id: index
    resource: ../../packages/pluginfinity/src/index.ts
    title: The library entry, exporting defineConfig and the config types
  - id: bin
    resource: ../../packages/pluginfinity/src/bin/pluginfinity.ts
    title: The bin shim
  - id: boundaries
    resource: ../../packages/pluginfinity/__test__/boundaries.test.ts
    title: The SourceBoundary scans, including the library entry's no-CLI rule
  - id: bats-helper
    resource: ../../packages/pluginfinity/bats/pluginfinity.bash
    title: The bats helper plugin tests load
  - id: build-script
    resource: ../../packages/pluginfinity/savvy.build.ts
    title: The build script, including the bats copy step
  - id: e2e
    resource: ../../packages/pluginfinity/__test__/e2e
    title: End-to-end tests that run the built bin
generated:
  by: okfit/claude-code
  at: 2026-10-06T21:43:13Z
  body_sha256: 49fa5d77b59cd166121333801b4dbf5ea228bf16f9aa483cbde5023505e29a29
---

# pluginfinity carrier package

## What it is

`packages/pluginfinity/` is the `pluginfinity` package on npm, the one package a user installs ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).[^package-manifest] It is both a bin and a library. It is the only package in the workspace that declares a bin, and its library entry is pluginfinity's one supported library surface. Every other package publishes under the `@pluginfinity` scope.

## Shape

- `src/bin/pluginfinity.ts` is the bin shim. It imports `main` from `@pluginfinity/cli/main` and passes the carrier's own name and version as the distribution, so `--version` reports `via pluginfinity <version>`.[^bin] The bundler keeps that import external, so the shim is not a second copy of the CLI.
- `src/index.ts` is the library entry. It exports `defineConfig` and the `PluginfinityConfig`, `PluginfinityConfigInput` and `KnownTargetId` types from [`@pluginfinity/targets`](targets.md).[^index] `defineConfig` returns its argument unchanged; its value is the type, which makes a misspelt target key, `false` as a target value, or a missing `name` an editor error. pluginfinity decodes the config again when it loads the file. The contract is the [config interface](../interfaces/config.md).
- Only the bin may import a front end. A boundary test fails if the library entry imports `@pluginfinity/cli`, so `import "pluginfinity"` in a user's config never loads the command tree.[^boundaries]
- It depends on every front end and on the full runtime closure (jiti and the `@effected/*` packages included) as regular `dependencies`, never `peerDependencies`, because npm, pnpm, yarn and bun only link bins for direct dependencies.
- Its manifest is still `private: true`, so nothing publishes it until the first-publish phase of [the roadmap](../roadmaps/pluginfinity-first-release.md).

## Bats helper

`bats/pluginfinity.bash` is the helper a plugin's bats tests load from `node_modules/pluginfinity/bats/`. Its `run_hook <target> <script> <fixture>` runs a built hook script from `builds/<target>/` under `env -i` with that host's environment, and for Copilot the `PLUGINFINITY_EVENT` the build writes, so a hook is tested as built. It sets `$status`, `$output` and `$stderr` and needs bats 1.5.0 or later. `run_script <target> <path> [--stdin <file>] [args...]` runs a built skill script or server launcher the same way, under `env -i` with the host's environment, and `run_monitor <target> <name> [--ticks <n>] [VAR=value...]` runs a built monitor's command from `builds/claude/monitors/monitors.json`, bounded by `PLUGINFINITY_MONITOR_MAX_TICKS` (one tick by default) and refusing a target with no monitors.[^bats-helper] The bundler copies only what the exports and bin reach, so `savvy.build.ts` copies `bats/` into `dist/dev/pkg` and `dist/prod/npm/pkg` after the build, and `turbo.json` lists `bats/**` as a build input.[^build-script] A test in `__test__/` covers the helper against a fixture plugin under `__test__/fixtures/`, kept there so CI's repository-wide bats run does not pick up the fixture's own suite. The [dogfood fixture](dogfood.md) is the helper's real user, and the library it tests is in [the engine](engine.md).

## Tests

Its `__test__/` holds the repository-wide shape checks, kept here so core and targets never need platform devDependencies. One is a layering test (`LayerPolicy` and `WorkspaceLayering` from `@effected/workspaces/testing`, against `__test__/fixtures/layers.json`, devDependency edges included). The others are `SourceBoundary` scans of every package's `src/`, each with a positive control.[^boundaries]

`__test__/e2e/` runs the built bin the way a user does.[^e2e] One test runs `pluginfinity doctor --agent` inside the [dogfood fixture](dogfood.md) and checks that its real config loads. The other gives it a config that leaves a timer running and checks that the bin still exits promptly with its whole JSON report (see the teardown in [the CLI](cli.md)).

The companion plugin and the dogfood fixture depend on this package as `"pluginfinity": "workspace:*"`; see [the bin-link gotcha](../gotchas/workspace-bin-needs-built-cli.md).

[^package-manifest]: `../../packages/pluginfinity/package.json`
[^index]: `../../packages/pluginfinity/src/index.ts`
[^bin]: `../../packages/pluginfinity/src/bin/pluginfinity.ts`
[^boundaries]: `../../packages/pluginfinity/__test__/boundaries.test.ts`
[^bats-helper]: `../../packages/pluginfinity/bats/pluginfinity.bash`
[^build-script]: `../../packages/pluginfinity/savvy.build.ts`
[^e2e]: `../../packages/pluginfinity/__test__/e2e`
