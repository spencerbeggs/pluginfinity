---
type: Module
title: pluginfinity_hooks, the Zig hook library
description: The Zig package at the repository root that plugins depend on to write hooks as native programs; build.zig builds every hook for five platforms, and zig/src holds the library, its generated event types and the executable's entry shim.
x-okfit-kind: package
x-okfit-layer: native hook library
resource: ../../zig
status: stable
tags:
  - architecture
  - portability
sources:
  - id: build-zig
    resource: ../../build.zig
    title: platforms, Options, addHooks and the library's own build
  - id: zon
    resource: ../../build.zig.zon
    title: The package manifest
  - id: hook-zig
    resource: ../../zig/src/hook.zig
    title: Hook, run, panic, testing, Facts and SessionEnv
  - id: events-zig
    resource: ../../zig/src/events.zig
    title: The generated event and tool-input types
  - id: zig-generator
    resource: ../../packages/core/src/hook-io/zig.ts
    title: hookEventsZig, which writes events.zig
  - id: entry
    resource: ../../zig/src/entry.zig
    title: The root of every hook executable
  - id: responder
    resource: ../../zig/test/responder.zig
    title: The test hook
  - id: zig-responses
    resource: ../../packages/engine/__test__/zig-responses.test.ts
    title: The library's contract test
  - id: readme
    resource: ../../zig/README.md
    title: The library's README
generated:
  by: okfit/claude-code
  at: 2026-11-25T21:50:47Z
verified:
  - by: human:spencer
    at: 2026-11-25T21:50:47Z
x-okfit-integrity:
  generated:
    body: 48bf5c821f430267
  verified:
    by: human:spencer
    at: 2026-11-25T21:50:47Z
    content: fdfcc229dd9ea525
---

# pluginfinity_hooks, the Zig hook library

## What it is

The library a plugin author links to write a hook as a native program ([decision](../decisions/zig-hook-library.md)). It is not a workspace package: pnpm and Turborepo do not see it. The root `build.zig.zon` makes this repository a Zig package, `pluginfinity_hooks`, whose files are `build.zig`, `build.zig.zon`, `zig/src` and `LICENSE`.[^zon] It needs Zig 0.17.1. It is experimental.[^readme]

## What it holds

- **`build.zig`.** As a dependency it gives a plugin one call, `addHooks(b, .{ .names = … })`, which builds each `native/<name>.zig` for the five `platforms`, names each file `<name>-<os>-<arch>` as a [`binary` entry](../decisions/native-hook-binaries.md) expects, and adds a `test` step. `source_dir`, `optimize` and `regex` are its options. Run on its own it tests the library, and with `-Ddev` it also tests the regular-expression matcher and installs the test hook `responder` and `responder-regex`.[^build-zig]
- **`zig/src/hook.zig`.** `hook.run(init, handler)` reads the event from stdin, calls the handler, writes at most one response and always exits 0. `hook.panic` makes a panic follow the entry's fail policy. The `Hook` a handler gets reads input by Claude Code's names (`input`, `as`, `toolInput`, `envelope`), answers (`noop`, `deny`, `allow`, `allowWith`, `ask`, `context`, `block`, `systemMessage`, `raw`, `relay`, `rewake`), asks what the host honours (`can`), reads the build's facts (`toolName`, `toolPrefix`, `has`), reads and writes session env (`env`, `envSet`), and wraps the system (`exec`, `readFile`, `exists`, `projectDir`, `sessionDir`, `cdProject`, `log`, `debug`). `hook.testing.respond` runs a handler on an input in a unit test.[^hook-zig]
- **`zig/src/events.zig`.** One type per hook event and per tool input, for `h.as` and `h.toolInput`. It is generated from the hook event schemas in [`@pluginfinity/core`](core.md) by `pnpm --filter @pluginfinity/core hook-io:zig`; never edit it by hand.[^events-zig][^zig-generator]
- **`zig/src/entry.zig`.** The root of every hook executable, compiled for size; it calls the author's `main`.[^entry]
- **`zig/src/regex_on.zig` and `regex_off.zig`.** The matcher behind the `regex` option, and the stub that declines every pattern without it.
- **`zig/examples/guard` and `zig/examples/recipes`.** Two example plugins. The second holds the sources of the five recipes the companion plugin's `native-hooks` skill prints.
- **`zig/test/responder.zig`.** A hook that sends whichever response its input asks for, which the contract test drives.[^responder]

## Rules

- The library answers in the same shapes as `hook.sh`. `packages/engine/__test__/zig-responses.test.ts` builds `responder` and checks every response on every event against that event's output schema, and the session env against the real `env.sh`. It needs `zig` on `PATH` and is skipped without it, which today includes CI.[^zig-responses]
- A change to an event's shape is made in `@pluginfinity/core`, then `events.zig` is generated again.
- `zig/examples/*/hooks/bin`, `builds`, `.zig-cache`, `zig-out` and `zig-pkg` are gitignored. The examples' binaries are built on demand, not committed.
- Keep `paths` in the manifest to the library. Anything added there is fetched by every plugin that depends on it.
- The regex engine stays a lazy dependency behind `-Ddev` in the library's own build, so a plugin never fetches it unless it sets `regex = true`.

[^build-zig]: `../../build.zig`
[^zon]: `../../build.zig.zon`
[^hook-zig]: `../../zig/src/hook.zig`
[^events-zig]: `../../zig/src/events.zig`
[^zig-generator]: `../../packages/core/src/hook-io/zig.ts`
[^entry]: `../../zig/src/entry.zig`
[^responder]: `../../zig/test/responder.zig`
[^zig-responses]: `../../packages/engine/__test__/zig-responses.test.ts`
[^readme]: `../../zig/README.md`
