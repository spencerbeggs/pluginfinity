---
type: Gotcha
title: A workspace plugin got no pluginfinity bin until the carrier was relinked after its build
description: Deprecated, the trap is gone. The carrier's bin now points at its source file, which exists at install time, so pnpm creates node_modules/.bin/pluginfinity on every install, --ignore-scripts included.
resource: ../../packages/pluginfinity/package.json
status: deprecated
tags:
  - dx
  - ci
sources:
  - id: carrier-manifest
    resource: ../../packages/pluginfinity/package.json
    title: Carrier manifest, whose bin points at src/bin/pluginfinity.ts with no publishConfig.directory
  - id: bin
    resource: ../../packages/pluginfinity/src/bin/pluginfinity.ts
    title: The source bin, which registers tsx before importing the CLI
  - id: plugin-manifest
    resource: ../../plugins/pluginfinity/package.json
    title: The companion plugin's package manifest and build scripts
generated:
  by: okfit/claude-code
  at: 2026-11-08T19:52:50Z
integrity:
  generated:
    body: 76ac7d4d9cc09c9e
---

# A workspace plugin got no pluginfinity bin until the carrier was relinked after its build

## Deprecated

This trap no longer exists. Read the [carrier module](../modules/pluginfinity.md) for how the bin resolves now.

## What the trap was

The carrier used to link dependents to a built directory (`publishConfig.directory` with `linkDirectory`), whose bin did not exist until a lifecycle build ran. pnpm decides which bins to create before it runs any build, so a clean install left the plugin workspaces with a `node_modules/pluginfinity` link and no `node_modules/.bin/pluginfinity`, and `pnpm exec pluginfinity` failed until the carrier was relinked.

## What removed it

The packages now build with `effected package build`, and the carrier no longer sets `publishConfig.directory` or `linkDirectory`, so workspace links resolve through `exports` to each package's `src/`.[^carrier-manifest] The carrier's `bin` points at `src/bin/pluginfinity.ts`, a file that exists at install time, so pnpm creates the shim on every install, including `pnpm install --ignore-scripts`. The source bin registers tsx itself when it runs as a `.ts` file, then imports the CLI, so it runs with no package built.[^bin] The plugins' scripts call the shim directly, as `pluginfinity build` and `pluginfinity validate`.[^plugin-manifest]

If `pnpm exec pluginfinity` fails in a plugin workspace now, this is not the cause; check that the install completed and that the root devDependency `tsx` is present.

[^carrier-manifest]: `../../packages/pluginfinity/package.json`
[^bin]: `../../packages/pluginfinity/src/bin/pluginfinity.ts`
[^plugin-manifest]: `../../plugins/pluginfinity/package.json`
