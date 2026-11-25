---
type: Decision
title: A native hook ships as prebuilt per-platform files that one hook statement selects
description: "A binary hook entry names a path prefix; the build copies every <prefix>-<os>-<arch> file beside it and renders one sh line that picks the file for the machine. pluginfinity never compiles."
status: stable
tags:
  - architecture
  - portability
sources:
  - id: owner
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-11-25T00:00:00Z
    title: The owner's brief for the experiment and the ruling that binaries are prebuilt
  - id: core-hooks
    resource: ../../packages/core/src/hooks.ts
    title: BinaryHook and the handler kinds
  - id: engine-hooks
    resource: ../../packages/engine/src/hooks.ts
    title: BINARY_DISPATCH, hookBinaries, entryEnv and onFailure
  - id: operations
    resource: ../../packages/engine/src/operations.ts
    title: binaryFiles, the platform files a build ships, and facts.json
  - id: tool-map
    resource: ../../packages/engine/src/tool-map.ts
    title: renderFacts
generated:
  by: okfit/claude-code
  at: 2026-11-25T21:50:46Z
verified:
  - by: human:spencer
    at: 2026-11-25T21:50:46Z
x-okfit-integrity:
  generated:
    body: 2d0f439c3cb58152
  verified:
    by: human:spencer
    at: 2026-11-25T21:50:46Z
    content: 73a384c64651bf3d
---

# A native hook ships as prebuilt per-platform files that one hook statement selects

## Context

A bash hook needs `jq` and the [hook library](hook-library-is-build-injected.md) on the user's machine, and the owner finds bash error-prone for anything past a few lines. The owner asked for hooks as self-contained native programs, with the right one chosen per platform by a single hook statement, and ruled that pluginfinity stays a transformer: it writes each host's JSON and copies files, and it does not run a compiler.[^owner] The [earlier Bun experiment](../references/claude-binary-plugin.md) had shown the idea works and that a 25 MB binary per platform does not.

## Decision

- A hook entry may be a `binary` entry: `binary` is a plugin-relative path prefix, not a file. Bash `script` entries stay, and stay the default.[^core-hooks]
- The author builds the platform files. The build ships every file named `<prefix>-<os>-<arch>` or `<prefix>-<os>-<arch>.exe` beside the prefix. No such file is a build failure, the same as a missing script, and so is a platform file without its executable bit.[^operations]
- `<os>` and `<arch>` are what `uname -s` and `uname -m` print, so the entry needs no lookup table. Under Git Bash, `MINGW*`, `MSYS*` and `CYGWIN*` become `Windows` and the file gets `.exe`.
- Each host's entry is the same one `sh -c` line, `BINARY_DISPATCH`, given the prefix as `$0` and the plugin root as `$1`. It `exec`s the file for the machine with the plugin root in `PLUGINFINITY_ROOT`. Claude Code gets it in exec form after `env K=V…`; Copilot gets it in the `bash` field with the facts in `env`.[^engine-hooks]
- A machine with no file for it exits `${PLUGINFINITY_FAIL_CLOSED:-0}`: 0 and silent by default, so the hook [fails open](hooks-fail-open.md), and 1 on a `failClosed` entry. On Claude Code a `failClosed` entry also renders `onFailure: "block"`, so the non-zero exit blocks; Copilot reads it as a deny on `preToolUse`.[^engine-hooks]
- A program cannot source `host.sh`, so the build writes `lib/pluginfinity/facts.json` into every target that has a binary hook: the target's tool names, what the plugin holds, and the declared session env names. The [entry facts](entry-facts-travel-as-env.md) reach it as the same `PLUGINFINITY_*` variables a script gets, plus `PLUGINFINITY_HOST` and `PLUGINFINITY_PLUGIN`.[^tool-map][^operations]

## Consequences

- pluginfinity depends on no compiler and can ship a binary built with anything, as long as the files follow the naming rule. The [Zig library](zig-hook-library.md) is the supported way to build them.
- pluginfinity cannot tell a stale binary from a fresh one, and `build --check` compares the copies in `builds/` with `hooks/bin/`, not with the source. The author must rebuild before `pluginfinity build`.
- A marketplace installs from a git ref, so a plugin that ships native hooks commits its platform files or builds them in CI.
- A `failClosed` guard denies on every platform the author did not build.
- The dispatch line needs `sh` and `uname`, which Windows has only under Git Bash.

## Alternatives rejected

- **pluginfinity compiles the hooks.** Rejected by the owner: the CLI would need a toolchain on every machine that runs `build`, and `build --check` would depend on a reproducible compiler.[^owner]
- **One entry per platform in the config.** Neither host can choose a hook entry by platform, so every entry would run everywhere and each would need its own guard.
- **A lookup table in the entry.** The naming rule makes it unnecessary, and a table would have to change whenever a platform is added.

[^owner]: conversation with the repository owner, 2026-11-25
[^core-hooks]: `../../packages/core/src/hooks.ts`
[^engine-hooks]: `../../packages/engine/src/hooks.ts`
[^operations]: `../../packages/engine/src/operations.ts`
[^tool-map]: `../../packages/engine/src/tool-map.ts`
