---
type: Limitation
title: Native hooks are unproven on Windows, Intel macOS and inside a live host session
description: The Windows and macOS x86_64 hook binaries are built and have never been run, no native hook has run inside a live Claude Code or Copilot session, CI does not build or test the Zig library, and the package cannot yet be fetched from GitHub.
status: stable
x-okfit-bounds: ../modules/zig-hooks.md
tags:
  - portability
  - testing
sources:
  - id: measurement
    resource: ../measurements/native-hook-binaries-2026-11-25.md
    title: What was and was not measured
  - id: build-zig
    resource: ../../build.zig
    title: The five platforms
  - id: zig-responses
    resource: ../../packages/engine/__test__/zig-responses.test.ts
    title: The contract test, skipped without zig
generated:
  by: okfit/claude-code
  at: 2026-11-25T21:50:48Z
verified:
  - by: human:spencer
    at: 2026-11-25T21:50:48Z
x-okfit-integrity:
  generated:
    body: fb7a0fd0b1c7be3f
  verified:
    by: human:spencer
    at: 2026-11-25T21:50:48Z
    content: 525f2f3b03e1b50f
---

# Native hooks are unproven on Windows, Intel macOS and inside a live host session

The [Zig hook library](../modules/zig-hooks.md) and [`binary` entries](../decisions/native-hook-binaries.md) are an experiment. These edges are known and open.

- **Windows.** `addHooks` builds `<name>-Windows-x86_64.exe` and the dispatch line maps Git Bash's `uname` to it, but the file has never run on Windows. Without Git Bash there is no `sh` for the entry, so the hook does not run and a `failClosed` entry cannot deny.[^build-zig][^measurement]
- **Intel macOS.** `<name>-Darwin-x86_64` is built and has never been run.
- **Live sessions.** Every run so far fed a binary its payload by hand or from a test. The symptom to expect if a host differs from its documentation is a hook that prints `{}` or nothing where a decision was expected. The typed events have not been checked against real Copilot payloads.
- **CI.** The runners have no Zig, so the contract test is skipped there and a change that breaks the library passes CI. Run it locally with `zig` on `PATH`.[^zig-responses]
- **Fetching.** `zig fetch --save git+https://github.com/spencerbeggs/pluginfinity` works only once `build.zig.zon` is on a pushed ref. Until then a plugin fetches a local checkout by path.
- **Stale binaries.** `pluginfinity build` copies whatever is in `hooks/bin/` and `build --check` cannot tell that the source changed since.

The first five are unfixed, not accepted: each closes with a run on the platform, a live session, Zig in CI, or a push. The last is the price of [not compiling](../decisions/native-hook-binaries.md) and stays.

[^measurement]: `../measurements/native-hook-binaries-2026-11-25.md`
[^build-zig]: `../../build.zig`
[^zig-responses]: `../../packages/engine/__test__/zig-responses.test.ts`
