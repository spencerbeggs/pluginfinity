---
type: Decision
title: The hook library is injected at build time
description: The bash helper library for hook scripts ships inside the engine, and build writes it into every target that has hooks, with a generated host.sh that names the host at run time.
status: draft
tags:
  - architecture
  - portability
  - dx
sources:
  - id: hook-library-spec
    resource: ../../docs/superpowers/specs/2026-10-03-hook-library-design.md
    title: Hook library design spec, with the prior-art survey of impeccable, plugin-bot and effected
    last_modified: 2026-10-03T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-03T19:33:34Z
  body_sha256: b88f046ffe25ed2883f1ea32159e838e4262970611d18a1b019b127013b8cf8c
---

# The hook library is injected at build time

## Context

A hook script has to read each host's input and answer in its output shape and exit-code contract, and the two hosts differ on all three: Claude nests responses under `hookSpecificOutput` where Copilot's are flat, an exit `1` on a pre-tool hook proceeds on Claude and denies on Copilot, and exit `2` on a stop hook blocks on Claude and only warns on Copilot ([Claude Code plugin format](../references/claude-code-plugin-format.md), [Copilot CLI plugin format](../references/copilot-cli-plugin-format.md)). The goal is one bash script with no host branches. The shared helper that hides those differences has to reach every built plugin without drifting.

plugin-bot copied its `hooks/lib/*.sh` templates into each plugin at setup time. All six copies had drifted from the template, none carried a version stamp, and the helpers covered only the pre-tool-use event and `additionalContext`.[^hook-library-spec] pluginfinity, unlike a runtime that must guess, knows the target when it builds.

## Decision

- The helper library ships inside the engine's carrier package, and `build` writes it to `hooks/lib/pluginfinity/` in each target that has at least one hook. A target with no hooks gets nothing.
- `build` also writes a generated `host.sh` beside it, setting the host, the plugin name and the library version. A script sources the library by a path relative to itself, and the library picks host behaviour at run time from `host.sh`.
- Hook scripts are never transformed. What a script runs in the repository is what a target ships.
- Library version equals the pluginfinity version, and `build --check` treats the injected files like any other output, so a stale copy is drift.
- `hooks/lib/pluginfinity/` is reserved. A source file there fails the build with `PathConflict`.

## Alternatives rejected

- **Vendoring at setup time**, plugin-bot's model: six drifted copies and no version stamp to detect it.[^hook-library-spec]
- **Build-time templating of scripts**: the shipped script would no longer be the authored script, which makes a failing hook hard to debug and a bats test of the source meaningless.
- **Per-host script forks**, as in effected's `orientation.sh` and `orientation.copilot.sh`: two files to keep in step for every hook.[^hook-library-spec]
- **Detecting the host from the shape of stdin**, as impeccable does: a guess that went wrong in its bug 646. The target is known at build time, so the build records it.[^hook-library-spec]

## Consequences

- Authors cannot patch the library locally. They write their own helpers beside it or contribute upstream.
- The library is bash, compatible with Bash 3.2, and needs `jq` at run time, consistent with [plugins carrying no Node dependencies](plugins-carry-no-node-dependencies.md).
- Failure behaviour is fixed by [hooks fail open](hooks-fail-open.md).
- The carrier package has to publish the library files, and the engine has to receive them through a service the carrier provides rather than locating them itself ([the carrier split](pluginfinity-ships-as-a-carrier-package.md)).

[^hook-library-spec]: `../../docs/superpowers/specs/2026-10-03-hook-library-design.md`
