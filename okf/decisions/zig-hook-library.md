---
type: Decision
title: The native hook library is a Zig package at the repository root
description: Native hooks are written in Zig 0.17.1 against a library that lives in this repository, whose root build.zig.zon makes the repository a Zig package holding only that library, with safety checks kept and the standard library compiled for size.
status: stable
tags:
  - architecture
  - portability
sources:
  - id: owner
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-11-25T00:00:00Z
    title: The owner's choices of Zig, of one repository, and of an opt-in regex engine
  - id: build-zig
    resource: ../../build.zig
    title: platforms, Options, addHooks and hookExecutable
  - id: zon
    resource: ../../build.zig.zon
    title: The package manifest, its paths and the lazy regex dependency
  - id: entry
    resource: ../../zig/src/entry.zig
    title: The size-optimized root of every hook executable
  - id: hook-zig
    resource: ../../zig/src/hook.zig
    title: The library
generated:
  by: okfit/claude-code
  at: 2026-11-25T21:50:47Z
verified:
  - by: human:spencer
    at: 2026-11-25T21:50:47Z
x-okfit-integrity:
  generated:
    body: 524f2b577b45fe5e
  verified:
    by: human:spencer
    at: 2026-11-25T21:50:47Z
    content: 35a8dae8d34670fc
---

# The native hook library is a Zig package at the repository root

## Context

[Native hooks ship prebuilt](native-hook-binaries.md), so the author needs a toolchain that builds every platform from one machine and a library that hides the differences between hosts, as `hook.sh` does for bash. The owner first tried Vercel's Zero language. It was ruled out in the session: its programs could not read piped stdin, which is how a hook receives its event, and it had no arm64 Linux target.[^owner] Bun had been ruled out [earlier](../references/claude-binary-plugin.md) on size.

## Decision

- Hooks are written in Zig, pinned to 0.17.1 by `minimum_zig_version`. One machine builds all five platforms: macOS arm64 and x86_64, Linux x86_64 and aarch64 (static, musl) and Windows x86_64.[^build-zig][^zon]
- The library lives in this repository. The root `build.zig.zon` makes the repository a Zig package named `pluginfinity_hooks` whose `paths` are `build.zig`, `build.zig.zon`, `zig/src` and `LICENSE`, so a plugin that fetches it gets only the library. A plugin adds it with `zig fetch --save git+https://github.com/spencerbeggs/pluginfinity` and calls `addHooks` from its own `build.zig`.[^zon][^build-zig]
- `addHooks` builds each named hook from `native/<name>.zig` for every platform, names the files the way a `binary` entry expects, and adds a `test` step that runs the hooks' unit tests on the build machine.[^build-zig]
- Every executable's root is `zig/src/entry.zig`, compiled `ReleaseSmall`, with the author's hook and the library as modules in `ReleaseSafe`. Zig compiles the standard library in the root module's mode and the standard library is most of a hook's size, so the binary is the size of an unchecked build while an out-of-bounds index in the hook or the library still panics. The library's panic handler then applies the entry's fail policy.[^entry][^build-zig]
- A regular-expression matcher is opt-in, `regex = true` in `addHooks`. The engine is a lazy dependency, so a plugin that does not ask for it never fetches it. Without it an exact list such as `startup|resume` still works, and a hook whose matcher is a regular expression runs for every value and says so in `error.log`.[^zon][^build-zig]
- The library mirrors the bash library's contract: one response per hook, always exit 0, [fail open](hooks-fail-open.md) unless the entry is `failClosed`, input read by Claude Code's names, and the same [session env](session-env-is-declared-and-resolved-once.md) chain.[^hook-zig]

## Consequences

- The repository root holds two build systems. Zig sees only the paths the manifest lists; pnpm and Turborepo do not see Zig.
- The package has no release of its own. A plugin pins a commit of this repository by hash, and the manifest's `version` is `0.0.0`.
- The library follows Zig's standard library closely, and that library changed a great deal by 0.17. A Zig upgrade is a library change, and the companion plugin's `native-hooks` skill carries a reference for the 0.17 spellings.
- CI has no Zig yet, so the test that runs the built library against the event schemas is skipped there.
- The whole surface is experimental and its API will change.

## Alternatives rejected

- **A separate `pluginfinity-hooks` repository.** Tried first and deleted at the owner's direction: the library and the build that consumes its output change together, and one repository keeps the dispatch line, the facts file and the library in one commit.[^owner]
- **`ReleaseSmall` throughout.** It saves almost nothing once the standard library is size-optimized, and it turns a bug into undefined behaviour, where a `failClosed` guard can let a call through ([measured](../measurements/native-hook-binaries-2026-11-25.md)).
- **Always linking the regex engine.** It adds about 165 KB to each binary for a need most hooks do not have.[^owner]

[^owner]: conversation with the repository owner, 2026-11-25
[^build-zig]: `../../build.zig`
[^zon]: `../../build.zig.zon`
[^entry]: `../../zig/src/entry.zig`
[^hook-zig]: `../../zig/src/hook.zig`
