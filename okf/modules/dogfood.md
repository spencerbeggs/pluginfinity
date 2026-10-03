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
  - id: e2e
    resource: ../../packages/pluginfinity/__test__/e2e/dogfood.e2e.test.ts
    title: The doctor smoke test that runs inside the fixture
generated:
  by: okfit/claude-code
  at: 2026-10-03T03:08:38Z
  body_sha256: dca34612216cc7ec1c756bf780b45fd10c6d1061f0aaed12b31fdc6c7f649013
---

# dogfood plugin fixture

## What it is

`plugins/dogfood/` is a plugin that exists only to be built by the CLI. The CLI will gain features that the [companion plugin](pluginfinity-plugin.md) has no use for, and dogfood is where those features are exercised end to end, through the real `pluginfinity` bin against a real plugin source.

## Shape

- `package.json` is the private package `@pluginfinity/dogfood-plugin`, ignored by changesets, depending on the CLI as `"pluginfinity": "workspace:*"`.[^package-manifest]
- It is listed under `ignore` in `.changeset/config.json`, so it is never versioned or released.[^changeset-config]
- It is not distributed through any marketplace. It is unrelated to the `plugins/dogfood/` sandbox in the bot repository.

- `pluginfinity.config.ts` is a real config: `name: "pluginfinity-dogfood"` with both `claude` and `copilot` enabled, imported through `defineConfig` from the workspace carrier.[^config]

## Status

It has a config and no plugin source yet. One end-to-end test exercises it: the carrier's dogfood smoke test runs the built `pluginfinity doctor --agent` inside it and requires its config check to pass.[^e2e] It grows during phase 2 of [the roadmap](../roadmaps/pluginfinity-first-release.md), alongside the builder, one exercised feature at a time.

[^package-manifest]: `../../plugins/dogfood/package.json`
[^changeset-config]: `../../.changeset/config.json`
[^config]: `../../plugins/dogfood/pluginfinity.config.ts`
[^e2e]: `../../packages/pluginfinity/__test__/e2e/dogfood.e2e.test.ts`
