---
type: Gotcha
title: A workspace plugin gets no pluginfinity bin unless the carrier is relinked after its build
description: pnpm links the plugin workspaces before any prepare build runs, so no pluginfinity shim is created and a repeat install or a later build does not repair it; the carrier's postprepare relinks.
resource: ../../packages/pluginfinity/package.json
status: draft
stale_after: 2026-12-31T00:00:00Z
tags:
  - dx
  - ci
sources:
  - id: carrier-manifest
    resource: ../../packages/pluginfinity/package.json
    title: Carrier manifest with publishConfig.linkDirectory and the postprepare relink
generated:
  by: okfit/claude-code
  at: 2026-10-03T03:08:38Z
  body_sha256: 385e0b8a32bce1a5048b43ac72df53ceeb96351c1e66e65db170b1327b6d1764
---

# A workspace plugin gets no pluginfinity bin unless the carrier is relinked after its build

## What you see

After a clean install, `plugins/dogfood/node_modules/pluginfinity` exists as a symlink but there is no `node_modules/.bin/pluginfinity`, and `pnpm --filter @pluginfinity/dogfood-plugin exec pluginfinity` fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`. The install log shows every package's `prepare` build succeeding in layer order. Running `pnpm install` again reports "Already up to date", and `pnpm build` or a test run that builds first leaves `dist/` in place, but neither creates the shim.

## What you will wrongly conclude

That the build failed or ran in the wrong order, that the `workspace:*` dependency is wrong, or that building the carrier is enough. None of those is the cause.

## What is actually true

The carrier sets `publishConfig.directory` to `dist/dev/pkg` with `linkDirectory: true`, so pnpm links dependents to the built package, whose `bin` points at `bin/pluginfinity.js`.[^carrier-manifest] pnpm links every workspace, and decides which bins to create, before it runs any `prepare` script. On a clean install `dist/dev/pkg` does not exist at that moment, so no shim is created, and pnpm does not revisit the link when the directory appears later. Building is necessary but not sufficient: only a relink creates the shim.

The fix is the carrier's `postprepare` script, which pnpm runs right after the carrier's own `prepare` build, when its whole dependency chain is already built:[^carrier-manifest]

```sh
cd ../.. && pnpm rebuild pluginfinity
```

`pnpm rebuild pluginfinity`, run from the workspace root, is the step that creates the shims in every dependent workspace. It does not re-run the carrier's `prepare`, so it does not loop. The built manifests under `dist/` carry no `scripts`, so the hook never reaches the published package. To recover by hand, for example after `pnpm install --ignore-scripts`, run `pnpm build` and then `pnpm rebuild pluginfinity` from the root. A filtered `pnpm rebuild --filter "./plugins/*"` does not relink.

The source `bin` at `src/bin/pluginfinity.ts` is not a usable fallback: it imports `@pluginfinity/cli/main`, which resolves to the CLI's built output, so it cannot run before the build either.

[^carrier-manifest]: `../../packages/pluginfinity/package.json`
