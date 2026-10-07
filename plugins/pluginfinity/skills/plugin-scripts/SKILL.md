---
name: plugin-scripts
description: >-
  Use when writing a script a pluginfinity plugin ships outside hooks, such as a skill's scripts/ or an
  MCP or LSP server launcher, or any plugin script that calls gh, git, aws, kubectl or another CLI.
  Covers server launchers on the server library, finding the plugin root and data directory on each
  host, calling CLIs without leaking or misusing credentials, persistent state, reading the plugin's
  session env, and testing scripts with bats.
paths:
  - "**/skills/**/scripts/**"
  - "**/bin/start-*.sh"
---

# Writing a plugin script

A plugin script runs in the user's shell environment, on a host you do not control. Resolve paths from what the host provides, treat inherited credentials as hostile, and keep state out of the plugin root. Hook scripts follow the `hook-authoring` skill instead. Server launchers start with the server library; see Server launchers.

## Server launchers

An MCP or LSP server's launcher is a POSIX `sh` script the server's config names, usually `bin/start-mcp.sh` run as `command: "sh"`, `args: ["${PLUGIN_ROOT}/bin/start-mcp.sh"]`. The build ships it to each host whose servers name it, writes the server library to `lib/pluginfinity/server.sh` in that build, and puts `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB` in the server's `env`. A launcher written on the library has no host branches:

```sh
#!/bin/sh
set -eu
. "$PLUGINFINITY_LIB/server.sh"
export MYPLUGIN_PROJECT_DIR="$(server_project_dir || true)"
server_exec_bin myplugin-mcp @myplugin/mcp "$@"
```

| Function | Does |
| :-- | :-- |
| `server_host` | Prints `claude` or `copilot` |
| `server_plugin_root` | Prints the build root, found from the library's own location |
| `server_project_dir` | Prints the user's project and returns 0, or prints nothing and returns 1 when there is none to report. On Claude it is `CLAUDE_PROJECT_DIR`. When the working directory is the plugin root or under it, as for every Copilot MCP server, it returns 1. A Copilot MCP server cannot learn the project at all: its working directory is the plugin root, its MCP client offers no roots and no variable names the project (measured on Copilot CLI 1.0.92, 2026-10-07). A Claude MCP server can read `CLAUDE_PROJECT_DIR` or ask for roots. Otherwise it is the closest directory above `$PWD` holding `.git`, else `$PWD` |
| `server_exec_bin <bin> <package> [--install <install-package>] [args]` | Execs the project's `node_modules/.bin/<bin>` when it is executable. Otherwise it prints, on stderr, that the bin is not installed and the install line for the project's package manager, then runs `<package> [args]` with that manager: `pnpm dlx`, `yarn dlx`, `bunx` or `npx --yes`. The manager is the `name` in `package.json`'s `devEngines.packageManager` (an object, or an array whose first entry counts), else `packageManager`, else a lockfile (`pnpm-lock.yaml`, `bun.lock`/`bun.lockb`, `yarn.lock`), else npm. A declared manager that is not `npm`, `pnpm`, `yarn` or `bun` is ignored and falls through to the lockfiles, then npm; without `jq` only `packageManager` is read. A manager that is not on `PATH` falls back to `npx --yes` with a stderr note. With no project directory it goes straight to `npx --yes`. `--install <install-package>` names a different package in the install line only, for a bin that ships in a package the runner cannot run directly; it is read only straight after the two positionals, and any later `--install` passes through to the server |
| `server_log <message>` | Appends a line to `error.log` in the plugin's log directory, with component `server`; see Logging |
| `server_debug <message>` | Appends a line to `debug.log` when `PLUGINFINITY_DEBUG=1`, with component `server` |

- Keep `set -eu` and source `$PLUGINFINITY_LIB/server.sh` first. Under `set -u` a launcher run outside a host, with no `PLUGINFINITY_LIB`, fails loudly instead of sourcing `/server.sh`.
- Never print to stdout before the `exec`: stdout carries the MCP or LSP protocol, and one stray line breaks the handshake. Send messages to stderr or `server_log`. The library itself writes only to stderr.
- `server_exec_bin` does not call `server_log`. Log yourself before it if you want a record.
- When the project installs the bin from one package but the runner needs another, such as a bundle package that ships several bins and a single-bin package for each, pass both: `server_exec_bin myplugin-mcp @myplugin/mcp --install @myplugin/plugin "$@"`. The install hint then names `@myplugin/plugin`, and the runner still runs `@myplugin/mcp`.
- Under `set -e`, a bare `server_project_dir` that returns 1 inside `$(...)` in an assignment ends the script. Add `|| true`, or test it: `if dir=$(server_project_dir); then ...`.
- Do not put your own files under `lib/pluginfinity/`: that directory is the build's, and a source file there fails the build with `PathConflict`. Keep launcher helpers beside the launcher, such as `bin/lib/`, and name them in `files`.
- The launcher must exist, sit inside the plugin, and be named without `.` or `..` segments. Run it through `sh` so it needs no executable bit; a `${PLUGIN_ROOT}/...` path used as the whole `command` must be an executable file, not a directory.
- Name it with `${PLUGIN_ROOT}`, never a host spelling such as `${CLAUDE_PLUGIN_ROOT}` or a brace-less `$PLUGIN_ROOT`: only `${PLUGIN_ROOT}` is rewritten per host, and any other spelling in a server's root fields fails the build.
- A `${PLUGIN_ROOT}/<dir>` reference, such as a data directory in `env`, ships every file under the directory. A reference ends at `:` and `,` too, so `PATH: "${PLUGIN_ROOT}/bin:/usr/bin"` ships `bin/`.
- Test the built launcher with bats, once per host. Make a fake project holding `.git/` and an executable stub at `node_modules/.bin/<bin>` that echoes its arguments, `cd` into it, and run `sh "$BUILDS/<host>/bin/<launcher>"` under `env -i` with `PATH`, `HOME`, `PLUGINFINITY_HOST=<host>`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB="$BUILDS/<host>/lib/pluginfinity"`, where `BUILDS` is the absolute path to `builds/`: after the `cd`, a relative launcher or library path no longer resolves. Assert stdout is exactly the stub's output, so nothing else reached it. The dogfood fixture's `__test__/servers.bats` does this.
- **Stub every runner on the controlled `PATH`: `pnpm`, `yarn`, `bun`, `bunx` and `npx`.** When the project lacks the bin, `server_exec_bin` runs the package with its package manager, and an unstubbed real runner on the test machine can start a real server. Put a stub for each, that only echoes its arguments, in a directory first on `PATH`.

## Logging

Hooks, server launchers, monitors and skill scripts all log through one standard. A line goes to
`${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/` as
`<ISO-8601 UTC> [<host>] <component>/<script>: <message>`, with the component `hook`, `server`, `monitor` or
`script` and the script's own file name.

| File | Holds |
| :-- | :-- |
| `error.log` | Failures, always written |
| `debug.log` | Debug lines, written only when `PLUGINFINITY_DEBUG=1` |

Read them with `pluginfinity logs`, from inside the plugin or with `--plugin <name>` (repeatable). It prints the
last 50 lines of each plugin's `error.log` (`--lines <n>` for more), `--debug` shows `debug.log` instead, and
`--follow` (`-f`) keeps printing new lines until Ctrl-C, which is how to watch a live session's hooks fire. Under
`--agent` or `--ci` it prints one JSON object, or one entry per line while following. Run from Claude Code's Bash tool it
detects an agent and prints the JSON; `--human` gives the sections.

`PLUGINFINITY_DEBUG=1` is the one debug switch. It also logs each hook's raw input, which can hold prompts and
tool inputs in plaintext, so unset it after a debugging session. A plugin from an earlier pluginfinity that reads a different
log file or sets a different debug variable needs updating to these.

| From | Calls | Library |
| :-- | :-- | :-- |
| A hook | `hook_log`, `hook_debug` | `hook.sh` |
| A server launcher | `server_log`, `server_debug` | `server.sh` |
| A monitor | `monitor_log`, `monitor_debug` | `monitor.sh` |
| A skill script | `script_log`, `script_debug` | `log.sh` |

The build writes `log.sh` to `lib/pluginfinity/log.sh` in every target, and the other libraries source it.
A skill script sources it by hand. It is POSIX `sh`, writes nothing to stdout, and needs `_pf_log_dir` set to
its directory first, because `sh` cannot find a sourced file's own path. From a script at
`skills/<skill>/scripts/<name>.sh`:

```sh
_pf_log_dir="$(dirname "$0")/../../../lib/pluginfinity"
. "$_pf_log_dir/log.sh"
script_log "could not read the config"
script_debug "read ${count} entries"
```

Without a readable `log.sh` the call fails, so source it only from a script that ships in a build. Add one
`..` per extra directory between the script and the plugin root.

## Monitors

A monitor is a script a `monitors` entry runs on Claude Code, whose stdout lines the model receives. Write
it on the monitor library (`monitor_every`, `monitor_notify`, `monitor_once`) and send nothing else to
stdout. The config, the library functions, the pitfalls and a bats recipe are in the `pluginfinity` skill's
[monitors](../pluginfinity/references/monitors.md).

## Where am I

Who launches the script decides which variables it has.

- A script a hook runs inherits the host's variables. On Claude Code they are `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_PROJECT_DIR` (Claude Code hooks reference). On Copilot CLI 1.0.91 (measured 2026-10-02, a hook command) `PLUGIN_ROOT`, `COPILOT_PLUGIN_ROOT` and `CLAUDE_PLUGIN_ROOT` were all set to the plugin root, and `COPILOT_PLUGIN_DATA` was set. `PLUGIN_DATA` was unset.
- A script a skill runs through the Bash tool does not inherit them. On Claude Code 2.1.291 such a script had only `CLAUDE_CODE_SESSION_ID`, and none of `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, `CLAUDE_SKILL_DIR` or `CLAUDE_ENV_FILE`, plus whatever SessionStart wrote to `CLAUDE_ENV_FILE` (measured downstream, 2026-10-07). Claude Code substitutes a `${...}` reference written in skill, command or agent Markdown when the skill loads (Claude Code plugins reference). On Copilot the skill-script environment is not measured; assume it is minimal and holds none of the plugin variables. Hand the script its paths: as arguments, or as environment the caller sets on the command line.
- To give the model the script's own path, write the command in `SKILL.md` with the `\{{skill_dir}}` token: `bash "\{{skill_dir}}/scripts/check.sh"`. Claude Code gets its skill-directory variable, which it expands on load; Copilot gets `<skill base directory>`, which the model fills from the base-directory line above the skill body. See the `pluginfinity` skill's [skill directories](pluginfinity://skill/pluginfinity/references/components.md#skill-directories).
- A script can always find its own plugin's files from `$0`. Never walk up from `$0` to find the user's project: that works only in a local checkout, because an installed plugin lives in a cache.

```bash
plugin_root="${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-$(cd "$(dirname "$0")/../../.." && pwd)}}"
data_dir="${CLAUDE_PLUGIN_DATA:-${COPILOT_PLUGIN_DATA:-}}"
```

- The `$0` fallback is the last resort. Use one `..` per directory between the script and the plugin root: the three above suit a script in `skills/<name>/scripts/`, and a script directly under `scripts/` needs one. The second leaves `data_dir` empty when the caller handed none, and every script that needs state must decide what that means. See State.
- In a hook command's text on Copilot, write `${PLUGIN_ROOT}` or `${CLAUDE_PLUGIN_ROOT}`. Copilot substitutes both. It leaves `${COPILOT_PLUGIN_ROOT}` as literal text there (measured, Copilot CLI 1.0.91, 2026-10-02), although the variable is set for a script to read.
- `${PLUGIN_DATA}` is unset in a Copilot hook's environment (same measurement). Use `COPILOT_PLUGIN_DATA`.
- For the user's project, use `${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}`, or take it as an argument. Hooks should call `hook_plugin_root` and `hook_project_dir` instead.

## Calling another CLI

Tools such as `gh`, `aws` and `kubectl` read their own environment variables before their keyring, profile or context. A stale `GH_TOKEN` in the user's shell beats a good `gh auth login`, and the plugin never notices.

- Namespace the plugin's own variable (`MYPLUGIN_GH_TOKEN`) and translate it to `GH_TOKEN` for one call. Never tell the user to export `GH_TOKEN`.
- Scrub the inherited token, and `GH_HOST` and `GH_REPO`, at every call site, with a per-call override (`VAR= cmd`, `env -u VAR cmd`) or a subshell `( unset VAR; cmd )`. Never put `unset` at the top of the script: it changes the environment for every later command.
- Scrub at the check and at the use. A probe that scrubs while the write call is bare passes against the keyring, then writes with the stale token. List every call site and confirm they agree.
- `gh auth status` exits non-zero when an invalid env token sits beside a valid keyring entry. Control the environment first, then read the exit code. `_gh_auth_ok` below does that only for the token it resolves.
- An inherited `GH_HOST` or `GH_REPO` points `gh` at the wrong host or repository. Scrub them too, and pass `--repo` when the plugin means a specific one.
- Set `GH_PAGER=cat` so `gh` never waits on a pager.
- Pass `--context` to `kubectl` and `helm`, and `--profile` to `aws`, whenever the plugin assumes a cluster or account. Their environment variables (`KUBECONFIG`, `AWS_PROFILE`) otherwise decide.
- Capture a status with `out=$(cmd 2>&1) || rc=$?`. After `cmd || true`, `$?` is always 0.

Copy this wrapper into the plugin's own `scripts/lib/`. It is valid bash 3.2.

```bash
_gh() {
	local token=""
	if [ -n "${MYPLUGIN_GH_TOKEN:-}" ]; then
		token="$MYPLUGIN_GH_TOKEN"
	elif [ -n "${GH_TOKEN:-}" ]; then
		token="$GH_TOKEN"
	elif [ -n "${GITHUB_TOKEN:-}" ]; then
		token="$GITHUB_TOKEN"
	fi
	if [ -n "$token" ]; then
		env -u GH_HOST -u GH_REPO GH_TOKEN="$token" GITHUB_TOKEN="$token" GH_PAGER=cat gh "$@"
	else
		# An empty GH_TOKEN counts as a token, so remove it and let gh use the keyring.
		env -u GH_TOKEN -u GITHUB_TOKEN -u GH_HOST -u GH_REPO GH_PAGER=cat gh "$@"
	fi
}
_gh_auth_ok() { _gh auth status >/dev/null 2>&1; }
```

Call `_gh pr view`, never bare `gh pr view`. The fallback to `GH_TOKEN` and `GITHUB_TOKEN` keeps the script working in CI, where they are the normal way in. The limit: with no `MYPLUGIN_GH_TOKEN`, the wrapper uses an inherited `GH_TOKEN`, so `_gh_auth_ok` then tests that token. A stale one still fails the check even when the keyring is good. To prefer the keyring, drop the two fallback branches.

## State

- Write persistent files to the data directory, never the plugin root. The plugin root is the install directory, which changes on every update (Claude Code plugins reference).
- Claude Code creates `${CLAUDE_PLUGIN_DATA}` on first reference, keeps it across updates and deletes it on uninstall (Claude Code plugins reference). A script a skill runs has no such variable unless the caller passes the path.
- Give the script a defined fallback when `data_dir` is empty. Either fail with a message that names the missing argument, or fall back to a cache under the user's own state directory, for example `${XDG_STATE_HOME:-$HOME/.local/state}/myplugin`.
- Create subdirectories with `mkdir -p "$data_dir/cache"` and never write under `plugin_root`.
- Do not rebuild `~/.claude/plugins/data/<id>/` by hand. The `<id>` form is the host's business.
- A script's working directory is whatever the agent last used. Do not assume it is the project root.

## Session values

A value decided once per session, such as a detected package manager or a switch in the project's `.env`, is the
plugin's session env: declared under `env` in the config, resolved when the session starts, and set by hooks
with `hook_env_set`. Every hook sees the values with no call. A skill script or a monitor sources `env.sh`, one
line, which sets every declared name in its shell:

```bash
_pf_lib_dir="$(dirname "$0")/../../../lib/pluginfinity"; . "$_pf_lib_dir/env.sh"   # skills/<skill>/scripts/x.sh
printf 'package manager: %s\n' "$MYPLUGIN_PM"
```

- **Source it in every skill script that reads a value.** On Claude Code the model's shell already holds the
  values, but on Copilot nothing does, so a script that skips `env.sh` works on one host only.
- **Run the script from the project.** A script has no session id, so `env.sh` finds the session by the project:
  `CLAUDE_PROJECT_DIR`, else the working directory walked up to its git root. From elsewhere it resolves the
  defaults live.
- **Never write a per-session file or `CLAUDE_ENV_FILE` by hand.** A plugin that does is migrated in the
  `pluginfinity` skill's [session env](pluginfinity://skill/pluginfinity/references/session-env.md#migrating-a-hand-rolled-session-env).

The precedence, the setup script, `.env` parsing, what each host's shell sees and the tests are in
[session env](pluginfinity://skill/pluginfinity/references/session-env.md).

## Testing a script

- Write plain bats tests in `__test__/`, with fixtures in `__test__/fixtures/`.
- Run the script under `env -i` and pass every variable it reads (`HOME`, `PATH`, `CLAUDE_PLUGIN_DATA`, `MYPLUGIN_GH_TOKEN`), so the user's real environment never decides a result.
- Put a stub `gh` first on `PATH` that prints its arguments and `GH_TOKEN`, and assert the stale token never reaches it.
- `run_hook` is for hooks only. It feeds a hook payload on stdin and reads a hook response, and it runs the
  script with the environment of the built entry that registers it, so a script no entry runs fails the call:
  use `run_script`.
- `run_script <target> <path> [--stdin <file>] [--cwd <dir>] [--env VAR=value]... [--env-file <file>] [--session-env <file>] [--interpreter <cmd>] [args...]`
  runs a built skill script or a launcher under `env -i` with `node` for a `.mjs`, `.cjs` or `.js` file and `bash` for
  anything else (`--interpreter <cmd>` names another). A path under
  `skills/` gets what the agent's Bash tool gives a skill script, which is not the plugin variables: `PATH`,
  `HOME`, `XDG_STATE_HOME` and, on Claude Code, `CLAUDE_CODE_SESSION_ID=test-session` (override it with `--env`),
  and none of `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, `CLAUDE_SKILL_DIR` or
  `CLAUDE_ENV_FILE`. That is what Claude Code was measured to give; on Copilot it gives only the base, which is
  not measured but assumed minimal. It runs from `--cwd` (default `$BATS_TEST_TMPDIR/project`, created, the same project
  `hook_fixture` and `run_hook` use) on both hosts. `--env-file` adds the `NAME=value` and `export NAME=value`
  lines of a file, parsed and not sourced (quotes stripped, nothing expanded), to model the exports a
  SessionStart hook wrote to `CLAUDE_ENV_FILE`. `--session-env` seeds the session env library's own values for
  session `test-session` and points the script's `--cwd` project at it, so a script that sources `env.sh` reads
  them; use it to test a reader, and `--env-file` to test what Claude Code's shell exports would do. Any other path, a launcher, gets the host's plugin variables and
  keeps the plugin root as the Copilot directory. Each `--env` adds one
  `VAR=value` and wins over `--env-file`; everything after the options, a bare `--` included, is an argument. It
  sets `$status`, `$output` and `$stderr`. The helper sets `XDG_STATE_HOME` to `$BATS_TEST_TMPDIR/state`, so a
  script that logs writes under the test's temp directory; read `error.log` there.
- `run_monitor <target> <name> [--ticks <n>] [--timeout <seconds>] [--cwd <dir>] [--session-env <file>] [VAR=value...]` runs a Claude monitor's built
  command from the project directory, without `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`
  or `CLAUDE_SESSION_ID`, bounded to `n` ticks by `PLUGINFINITY_MONITOR_MAX_TICKS`, which every monitor must
  honour, and to `--timeout` seconds (default 30, at least 1), past which the monitor is killed and `$status` is 124.
  A `--ticks` run that waits between polls needs a `--timeout` above `(n - 1)` intervals. See [monitors](../pluginfinity/references/monitors.md#test-one).
- macOS ships bash 3.2, so the script must avoid `${var^^}`, `declare -A`, `mapfile` and `local -n`.
- Run `bats --recursive __test__`.
