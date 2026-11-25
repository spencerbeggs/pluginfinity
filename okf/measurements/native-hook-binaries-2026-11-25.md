---
type: Measurement
title: Native hook size, start-up and parity with the bash library, 2026-11-25
description: A Zig hook built by addHooks is about 218 KB and starts in about 2.5 ms against about 67 ms for the bash hook; its responses pass every event's output schema and its session env matches env.sh. Windows and Intel macOS binaries were built and never run.
tags:
  - portability
  - testing
status: stable
stale_after: 2027-02-25T00:00:00Z
x-okfit-justifies: ../decisions/zig-hook-library.md
sources:
  - id: session
    resource: the implementing agent session of 2026-11-25, on an Apple silicon Mac with Zig 0.17.1
    author: okfit/claude-code
    last_modified: 2026-11-25T00:00:00Z
    title: Size, timing and cold-trial runs made in the session; the figures were not written to a file
  - id: zig-responses
    resource: ../../packages/engine/__test__/zig-responses.test.ts
    title: The built library run on every event against the hook event schemas and the bash library
  - id: recipes-test
    resource: ../../packages/pluginfinity/__test__/recipes.test.ts
    title: The skill's recipes kept equal to the example plugin's sources
  - id: build-zig
    resource: ../../build.zig
    title: hookExecutable, the build the figures are for
generated:
  by: okfit/claude-code
  at: 2026-11-25T21:50:48Z
verified:
  - by: human:spencer
    at: 2026-11-25T21:50:48Z
x-okfit-integrity:
  generated:
    body: 3a8ebfc185672e3d
  verified:
    by: human:spencer
    at: 2026-11-25T21:50:48Z
    content: 35299d5998c67a71
---

# Native hook size, start-up and parity with the bash library, 2026-11-25

## Method

All runs were on one Apple silicon Mac with Zig 0.17.1, in the agent session that wrote the library. The size and timing figures below come from that session and are rounded; they were not saved, so treat them as about right and measure again before quoting them.[^session] The parity results are a test in the repository and can be run again with `zig` on `PATH`.[^zig-responses]

## Size

A hook that reads one input field and denies, built for macOS arm64:[^session][^build-zig]

| Build | Size |
| :-- | :-- |
| Everything `ReleaseSafe` | about 354 KB |
| `ReleaseSmall` root shim, hook and library `ReleaseSafe`, no unwind tables (what `addHooks` builds) | about 218 KB |
| The same with `regex = true` | about 165 KB more |

The split build still panicked on an out-of-bounds index in the hook. Making the hook and the library `ReleaseSmall` as well saved almost nothing more, because the standard library, which is most of the binary, is already compiled in the root module's mode.

The Bun binary of the [earlier experiment](../references/claude-binary-plugin.md) was about 25 MB.

## Start-up

A native hook answered in about 2.5 ms. The same hook as a bash script sourcing `hook.sh` and calling `jq` took about 67 ms.[^session]

## Parity

`zig-responses.test.ts` builds a hook that sends whichever response it is asked for and checks, among other things:[^zig-responses]

- every response on every one of the 34 events exits 0 with one answer that event's output schema accepts;
- a failing handler and a panic both follow the entry's fail policy;
- the library agrees with the bash library on which events take a deny, a block and context;
- session env resolves as `env.sh` does, and each library reads what the other's `envSet` wrote.

The five recipes in the companion plugin's `native-hooks` skill are the sources of `zig/examples/recipes`, held equal by a test, and that example builds and passes `zig build test`.[^recipes-test]

## A cold trial

A separate headless Claude Code process, given only the `native-hooks` skill, wrote two new hooks. Both compiled and passed their tests first time, built for all five platforms, and answered correctly by hand for both hosts.[^session]

## What was not measured

- The Windows and macOS x86_64 binaries were built and never run. The Linux binaries were run only in a container.
- No native hook has run inside a live Claude Code or Copilot session; every run fed the binary a payload by hand or from a test.
- `zig fetch` from the GitHub URL, which needs the manifest on a pushed ref, and whether a plugin that leaves `regex` off really skips the engine on a clean machine.

[^session]: the implementing agent session of 2026-11-25
[^zig-responses]: `../../packages/engine/__test__/zig-responses.test.ts`
[^recipes-test]: `../../packages/pluginfinity/__test__/recipes.test.ts`
[^build-zig]: `../../build.zig`
