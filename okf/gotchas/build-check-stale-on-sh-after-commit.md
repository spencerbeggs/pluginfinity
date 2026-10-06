---
type: Gotcha
title: Hook scripts change mode around every commit with no diff, and build --check ignores it
description: The managed husky hooks chmod +x every tracked *.sh after a commit, merge or checkout with core.fileMode=false, while lint-staged strips the bit at commit; build --check compares content and only a copied file's executable bit, so the churn is not drift.
resource: ../../packages/engine/src/emit.ts
status: draft
stale_after: 2027-01-01T00:00:00Z
tags:
  - dx
  - ci
sources:
  - id: emit
    resource: ../../packages/engine/src/emit.ts
    title: planEmit and sameMode, which compare a generated file by bytes only and a copied file by bytes and executable bit
  - id: post-commit
    resource: ../../.husky/post-commit
    title: The savvy-hooks managed section that sets core.fileMode=false and runs chmod +x on every tracked *.sh; post-merge and post-checkout carry the same section
  - id: lint-staged-config
    resource: ../../lib/configs/lint-staged.config.ts
    title: The lint-staged config, which hands the shell-script rules to the silk preset
generated:
  by: okfit/claude-code
  at: 2026-10-06T02:28:06Z
  body_sha256: 381b65387fe7f047033ed274c09c1c78c283e13bd93441d23c0779470e21f65e
---

# Hook scripts change mode around every commit with no diff, and build --check ignores it

## What you see

After a commit, merge or checkout, `ls -l` shows every tracked `.sh` file, sources and the copies under `builds/<target>/hooks/` alike, as `755`, while git records them as `100644`. `git status` is clean, and so is `pluginfinity build --check`.

## What you will wrongly conclude

That the modes on disk are drift to fix, or that `build --check` is missing a real difference. Neither is true.

## What is actually true

The managed section of the husky `post-commit`, `post-merge` and `post-checkout` hooks sets `core.fileMode=false` and runs `chmod +x` on every tracked `*.sh` file.[^post-commit] The lint-staged `*.sh` rule from the silk preset runs `chmod -x` on staged scripts at commit time, so commits land them without the bit.[^lint-staged-config] With `core.fileMode=false` git ignores the local mode, so nothing shows in a diff.

`build --check` compares a generated file (one with no source mode, such as the hook library) by its bytes only, and a copied file by its bytes and its executable bit, never the other permission bits.[^emit] Because the hooks flip sources and built copies together, the check stays clean through that churn. It still fails when a copied file's executable bit differs from its source's, which is a real difference under `scripts.invoke: "exec"`; run `pluginfinity build` to write the source's mode again.

See [the engine](../modules/engine.md) for how the build copies and compares files.

[^emit]: `../../packages/engine/src/emit.ts`
[^post-commit]: `../../.husky/post-commit`
[^lint-staged-config]: `../../lib/configs/lint-staged.config.ts`
