---
type: Gotcha
title: build --check reports BuildStale on .sh files right after a commit, with no diff
description: lint-staged strips the executable bit from staged *.sh files while the build copies hook scripts with their source mode and compares modes, so the build looks stale until the next pluginfinity build.
resource: ../../packages/engine/src/operations.ts
status: draft
stale_after: 2027-01-01T00:00:00Z
tags:
  - dx
  - ci
sources:
  - id: operations
    resource: ../../packages/engine/src/operations.ts
    title: copyFile, which reads each shipped file's mode, and the planEmit comparison that treats a mode change as drift
  - id: lint-staged-config
    resource: ../../lib/configs/lint-staged.config.ts
    title: The lint-staged config, which hands the shell-script rules to the silk preset
generated:
  by: okfit/claude-code
  at: 2026-10-03T20:49:08Z
  body_sha256: 0f07fe352b9ddb748b4f7260162a19e3cc189b05c23df3ea99c162b72354da2f
---

# build --check reports BuildStale on .sh files right after a commit, with no diff

## What you see

You commit a change that touches a hook script, then run `pluginfinity build --check` and it fails with `BuildStale`, naming one or more `.sh` files under `builds/<target>/hooks/`. `git status` is clean and `git diff` is empty.

## What you will wrongly conclude

That the committed build is out of date with its source, or that the build is nondeterministic. Neither is true, and there is nothing to fix in the scripts.

## What is actually true

The build copies each hook script with its source file's mode, and the emit comparison counts a differing mode as drift.[^operations] The lint-staged `*.sh` rule, supplied by the silk preset that [the repository's lint-staged config](../../lib/configs/lint-staged.config.ts) loads, runs `chmod -x` on every staged shell script at commit time.[^lint-staged-config] The commit therefore lands the scripts without the executable bit, while the generated builds were written before it, with the bit set. Git records only the executable bit, so the two trees disagree on mode and nothing shows in a diff.

Running `pluginfinity build` once rewrites the copies to the sources' modes and clears the report, again with no git diff. See [the engine](../modules/engine.md) for how the build copies and compares files.

[^operations]: `../../packages/engine/src/operations.ts`
[^lint-staged-config]: `../../lib/configs/lint-staged.config.ts`
