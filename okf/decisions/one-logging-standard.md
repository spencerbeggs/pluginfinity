---
type: Decision
title: Hooks, servers, monitors and scripts share one logging standard
description: One log.sh, injected into every target, writes error.log always and debug.log when PLUGINFINITY_DEBUG=1, in one line format under one per-plugin state directory, replacing the per-component log files and PLUGINFINITY_HOOK_DEBUG.
status: draft
tags:
  - observability
  - dx
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-06T00:00:00Z
  - id: log-lib
    resource: ../../packages/engine/log-lib/log.sh
    title: The POSIX sh logging library
  - id: lib-files
    resource: ../../packages/engine/src/lib-files.ts
    title: LIB_DIR and libFiles, the injected library files
  - id: hook-lib
    resource: ../../packages/engine/hook-lib/hook.sh
    title: hook_log and hook_debug
  - id: server-lib
    resource: ../../packages/engine/server-lib/server.sh
    title: server_log and server_debug
generated:
  by: okfit/claude-code
  at: 2026-10-06T21:43:13Z
  body_sha256: 3f1420a6c7f11e089656d5afe70565de188fd2ed7b2f91ac3fafb559a6f378e1
---

# Hooks, servers, monitors and scripts share one logging standard

## Context

The hook library wrote `hook-error.log` and, under `PLUGINFINITY_HOOK_DEBUG=1`, `hook-debug.log`; the server library wrote `server-error.log`. A skill script or a monitor had no way to log at all. A maintainer debugging a plugin on a host had to know which file each component wrote and which switch turned on each, and the lines differed in shape. The owner directed that every component a plugin runs log the same way.[^owner-direction]

## Decision

- `log.sh` is one POSIX `sh` library, embedded in the engine and written to `lib/pluginfinity/log.sh` in every target, beside `host.sh`.[^log-lib][^lib-files] It writes nothing to stdout.
- Every component writes to `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/`: `error.log` always, and `debug.log` only when `PLUGINFINITY_DEBUG=1`. One line is `<ISO-8601 UTC> [<host>] <component>/<script>: <message>`.[^log-lib]
- The component is `hook`, `server`, `monitor` or `script`. The hook library offers `hook_log` and `hook_debug`, the server library `server_log` and `server_debug`, the monitor library `monitor_log` and `monitor_debug`, and a skill script sources `log.sh` itself and calls `script_log` and `script_debug`.[^hook-lib][^server-lib] A sourcer sets `_pf_log_dir` to the library directory first, since POSIX `sh` cannot find a sourced file's own path.
- `PLUGINFINITY_HOOK_DEBUG` is removed. `PLUGINFINITY_DEBUG=1` is the one switch.
- A library that cannot load `log.sh` falls back to no-op logging functions and carries on, so a missing log library never breaks the component, which keeps [hooks failing open](hooks-fail-open.md).

## Consequences

- A maintainer reads one directory per plugin and one line shape, whichever component wrote it.
- This breaks anyone reading `hook-error.log`, `hook-debug.log` or `server-error.log`, or setting `PLUGINFINITY_HOOK_DEBUG`. The [dated measurements](../measurements/hook-library-live-2026-10-03.md) of the earlier run still name the old files and switch, because they record what that run saw.
- Every target ships `log.sh`, even one with no hooks, since a skill script may source it.

## Alternatives rejected

- **Keep one file pair per component.** That is the divergence this removes.
- **Log to stderr.** A host shows or swallows hook and monitor stderr differently, and a stdio server's stderr is the host's.

[^owner-direction]: conversation with the repository owner, 2026-10-06
[^log-lib]: `../../packages/engine/log-lib/log.sh`
[^lib-files]: `../../packages/engine/src/lib-files.ts`
[^hook-lib]: `../../packages/engine/hook-lib/hook.sh`
[^server-lib]: `../../packages/engine/server-lib/server.sh`
