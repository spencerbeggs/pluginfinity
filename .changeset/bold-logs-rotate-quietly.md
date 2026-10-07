---
"@pluginfinity/engine": minor
---

## Breaking Changes

The hook, server and monitor libraries now share one logging standard and a new hook-output contract. No compatibility shims are provided; migrate each plugin as described.

* Logs are written to `error.log` and `debug.log` with a single line format. `hook-error.log`, `hook-debug.log` and `server-error.log` are no longer written.
* `PLUGINFINITY_DEBUG` is the only debug switch. `PLUGINFINITY_HOOK_DEBUG` is removed.
* `hook_allow` now takes `[reason] [updated-input-json]`.
* `hook_project_dir` follows the tool call's `cwd`. Use `hook_session_dir` for the session's project.
* `hook_project_dir` is never empty: the input's absolute `cwd` resolves to its git root or itself, then `CLAUDE_PROJECT_DIR`, then `$PWD`, and a plugin directory is never walked.
* A source `monitors/monitors.json` fails the build as `PathConflict` (`reserved-monitors-file`) whenever the target builds monitors. Declare monitors in `pluginfinity.config.ts` instead.
* Claude Code script hook entries render as `env K=V... bash <path>` so the event and fail policy reach every entry.
* A hook script path containing `=` fails the build under `scripts.invoke: "exec"`.
* `PLUGINFINITY_MONITOR_MAX_TICKS=0` no longer stops a monitor; it is unbounded, with a log line.

## Features

### Monitors

Monitors build from the config's `monitors` component into Claude Code's `monitors/monitors.json`, with the new `lib/pluginfinity/monitor.sh` library. Copilot, which has no monitors, gets a `monitor-omitted` build note. A monitor's `on-skill-invoke:<skill>` is written for Claude as `on-skill-invoke:<plugin>:<skill>`, and a skill the plugin does not build fails the build.

### Shared logging

`lib/pluginfinity/log.sh` is shared by hooks, servers, monitors and skill scripts. Servers gain `server_debug`.

### Server library

* `server_exec_bin`'s fallback uses the project's package manager (from `devEngines.packageManager`, `packageManager` or lockfiles) instead of always `npx`.
* A declared package manager the server library does not know falls through to lockfiles, then npm.

### Session env

* `env` in the config declares session variables resolved once at SessionStart through the chain default, `setup` script, `.env`, `.env.local`, ambient environment, then `hook_env_set`. A build with `env` writes `lib/pluginfinity/env.sh` and `env-run.sh` and adds a first SessionStart entry that runs the runner (timeout 15 s); a SessionStart reader waits up to 3 s for it, since Claude runs an event's hooks in parallel.
* The hook library sources `env.sh` before every hook body, so every hook sees the values. A skill script or monitor sources `lib/pluginfinity/env.sh` with one line.
* New `hook_env_set NAME value` (producer events and declared names only, always returns 0, appends to `CLAUDE_ENV_FILE` on Claude) and `hook_supports env-shell`.
* An `env.setup` script that is missing or not a file fails the build as `HookScriptInvalid` with component `env`.

### Skill directories

* New `{{skill_dir}}` and `{{skill_dir <skill>}}` body tokens: `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PLUGIN_ROOT}/skills/<skill>` on Claude, and the placeholder `<skill base directory>` on Copilot, which expands no path in a body. The bare form in an agent body, and a named skill from a Copilot agent, fail the build.

### Hook library

* `failClosed` on a hook entry makes a hook crash block instead of fail open.
* New helpers: `hook_require_input`, `hook_envelope`, `hook_relay` and `hook_tool_name` (in `tools.sh`).
* `hook_has` and `hook_tool_prefix` read what the target builds and the server tool prefix from `tools.sh`.
* `monitor_once` keys on `CLAUDE_CODE_SESSION_ID`, then `CLAUDE_SESSION_ID`, then `$PPID`, and every monitor honours `PLUGINFINITY_MONITOR_MAX_TICKS`.
* On Copilot, matchers are enforced at run time for `SessionStart`, `SessionEnd` and `SubagentStop`, which the host ignores.
* New build notes: `hook-matcher-runtime`, `hook-output-ignored` and `monitor-omitted`.
* Copilot reports a fresh session's SessionStart source as `new`, so a SessionStart matcher that holds `startup` is widened to hold `new` as well on a host that ignores the matcher (`hook-matcher-widened`), and a regex matcher that matches `startup` but not `new` is left as written with a `hook-matcher-regex` note.
* New build notes `env-shell-unsupported` (the host passes no session env to the model's shell, so a skill script must source `env.sh`) and `env-wait-timeout` (a SessionStart entry with a `timeout` under 5 s).
* `PLUGINFINITY_MONITOR_MAX_TICKS` must be a positive integer and counts every check, however triggered; anything else, `0` included, is logged once and treated as unbounded.

### Build

* Per-target files for skills, agents and other copied files.
* `{{tool X | fallback}}` supplies a spelling when a host cannot name the tool.
* ``{{tool `X`}}`` renders the tool name in a code span where the host spells it, and the plain fallback elsewhere. A code span jammed against the kind, ``{{tool`X`}}``, is reported as a token problem.
* `hook_has` lists a skill or agent only on the hosts that build it (`targets: { copilot: false }` is honoured).
