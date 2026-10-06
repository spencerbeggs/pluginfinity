---
"@pluginfinity/engine": minor
---

## Breaking Changes

The hook, server and monitor libraries now share one logging standard and a new hook-output contract. No compatibility shims are provided; migrate each plugin as described.

* Logs are written to `error.log` and `debug.log` with a single line format. `hook-error.log`, `hook-debug.log` and `server-error.log` are no longer written.
* `PLUGINFINITY_DEBUG` is the only debug switch. `PLUGINFINITY_HOOK_DEBUG` is removed.
* `hook_allow` now takes `[reason] [updated-input-json]`.
* `hook_project_dir` follows the tool call's `cwd`. Use `hook_session_dir` for the session's project.
* Claude Code script hook entries render as `env K=V... bash <path>` so the event and fail policy reach every entry.
* A hook script path containing `=` fails the build under `scripts.invoke: "exec"`.
* A source `monitors/monitors.json` is a build error. Declare monitors in `pluginfinity.config.ts` instead.

## Features

### Monitors

Monitors build from the config's `monitors` component into Claude Code's `monitors/monitors.json`, with the new `lib/pluginfinity/monitor.sh` library. Copilot, which has no monitors, gets a `monitor-omitted` build note.

### Shared logging

`lib/pluginfinity/log.sh` is shared by hooks, servers, monitors and skill scripts. Servers gain `server_debug`.

### Server library

* `server_exec_bin`'s fallback uses the project's package manager (from `devEngines.packageManager`, `packageManager` or lockfiles) instead of always `npx`.

### Hook library

* `failClosed` on a hook entry makes a hook crash block instead of fail open.
* New helpers: `hook_require_input`, `hook_envelope`, `hook_relay` and `hook_tool_name` (in `tools.sh`).
* On Copilot, matchers are enforced at run time for `SessionStart`, `SessionEnd` and `SubagentStop`, which the host ignores.
* New build notes: `hook-matcher-runtime`, `hook-output-ignored` and `monitor-omitted`.

### Build

* Per-target files for skills, agents and other copied files.
* `{{tool X | fallback}}` supplies a spelling when a host cannot name the tool.
