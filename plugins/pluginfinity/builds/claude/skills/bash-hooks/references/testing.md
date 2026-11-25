# Testing hooks with bats

pluginfinity ships a bats helper that runs a plugin's built hook scripts the way each host runs them. Put
tests in `plugins/<name>/__test__/*.bats` and hand-written inputs in `__test__/fixtures/*.json`. Load the
helper at the top of each file:

```bash
load "$BATS_TEST_DIRNAME/../node_modules/pluginfinity/bats/pluginfinity.bash"
```

| Helper | Does |
| :-- | :-- |
| `run_hook <target> <script> <fixture> [--matcher <m>] [--session-env <file>] [--env-wait] [VAR=value...]` | Runs `builds/<target>/<script>` under `env -i` with that host's environment and the fixture on stdin, applying the environment of the built entry that runs the script. The three options may stand anywhere after the fixture, mixed with `VAR=value` arguments; only the exact words are options, so `EXTRA=--matcher` stays a variable. `--session-env` seeds the session values a reader sees, for the fixture's `session_id`. An unseeded `SessionStart` hook resolves at once, without the library's wait for the runner, unless `--env-wait` is given; see [session env](${CLAUDE_PLUGIN_ROOT}/skills/pluginfinity/references/session-env-testing.md). Sets bats `$status`, `$output` and `$stderr`. A relative fixture is read from `__test__/fixtures/`. See below |
| `assert_hook_exit <n>` | The exit code is `n` |
| `assert_hook_json <jq-filter> <expected>` | The filter's raw value over stdout equals `expected` |
| `assert_hook_noop` | Exit 0 with no output or `{}` |
| `hook_fixture <event> [overrides-json]` | Writes a Claude-shaped input for the event to a temp file and prints its path |
| `run_script <target> <path> [--stdin <file>] [--cwd <dir>] [--env VAR=value]... [--env-file <file>] [--session-env <file>] [--interpreter <cmd>] [args...]` | Runs `builds/<target>/<path>` under `env -i`, with `node` for a `.mjs`, `.cjs` or `.js` script and `bash` for anything else (`--interpreter <cmd>` names another, `bash -x` included): a skill script or a launcher. A path under `skills/` gets what the agent's Bash tool gives a skill script: `PATH`, `HOME`, `XDG_STATE_HOME` and, on Claude Code, `CLAUDE_CODE_SESSION_ID=test-session`, but none of `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, `CLAUDE_SKILL_DIR` or `CLAUDE_ENV_FILE` (on Copilot nothing beyond the base: not measured there, assumed minimal). It runs from `--cwd` (default the test project, below) on both hosts. `--env-file` adds the `NAME=value` and `export NAME=value` lines of a file, parsed and not sourced, modelling the exports a SessionStart hook wrote to `CLAUDE_ENV_FILE`. `--session-env` seeds session `test-session` and points the script's project at it, so a script that sources `env.sh` reads the values. Any other path, a launcher, gets the host's plugin variables and keeps the plugin root as the Copilot directory. Stdin is `/dev/null` unless `--stdin` is given. Each `--env` adds one `VAR=value` and wins over `--env-file`; everything after the options, a bare `--` included, reaches the script as an argument. Sets `$status`, `$output` and `$stderr` |
| `run_monitor <target> <name> [--ticks <n>] [--timeout <seconds>] [--cwd <dir>] [--session-env <file>] [VAR=value...]` | Runs a monitor's command from `builds/claude/monitors/monitors.json` the way Claude Code starts it: from `--cwd` (default the test project, below), with `${CLAUDE_PLUGIN_ROOT}` substituted into the command text, none of `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` or `CLAUDE_SESSION_ID` set, `CLAUDE_CODE_SESSION_ID=test-session` and stdin `/dev/null`. Bounded to `<n>` ticks (default 1) through `PLUGINFINITY_MONITOR_MAX_TICKS`, and to `--timeout` seconds (default 30, at least 1) of wall-clock time: past it the process group is killed and `$status` is 124. `--session-env` seeds session values as for `run_script`. Any target but `claude` fails with status 1. See [monitors](${CLAUDE_PLUGIN_ROOT}/skills/pluginfinity/references/monitors.md) |

The dogfood plugin tests its `PreToolUse` hook on both targets:

```bash
@test "PreToolUse denies the marker command on both targets" {
  run_hook claude hooks/pre-tool-use.sh pretooluse.deny.json
  assert_hook_json .hookSpecificOutput.permissionDecision deny
  run_hook copilot hooks/pre-tool-use.sh pretooluse.deny.json
  assert_hook_json .permissionDecision deny
}

@test "PreToolUse lets other commands through" {
  run_hook claude hooks/pre-tool-use.sh pretooluse.allow.json
  assert_hook_noop
}
```

For a quick case without a fixture file, build one: `run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":false}')"`.

`run_hook` finds the built entry that runs the script, under the fixture's `hook_event_name`, and runs the script
with that entry's environment: the leading `K=V` args of a Claude exec-form entry, the leading `export K='V';`
of a Claude `command` entry, or a Copilot entry's `env` field. An explicit `VAR=value` argument wins over the
entry. `--matcher <m>` picks between entries that run one script; it is an exact string compared with the
entry's matcher, and goes right after the fixture. On Copilot, `SessionStart`, `SessionEnd` and `SubagentStop`
entries carry the matcher as `PLUGINFINITY_MATCHER` in `env`, and `--matcher` reads it from there. When several entries match and there is no
`--matcher`, it uses the first and says so on stderr; when the event has no entry it says so on stderr and uses
the entries for any event. When no entry runs the script at all, the call fails: use `run_script` for a script
no entry registers.

Every helper shares one test project, `$BATS_TEST_TMPDIR/project`, which the helper creates on first use. It is
the default for `hook_fixture`'s input `cwd`, for `CLAUDE_PROJECT_DIR` in `run_hook` on Claude Code, and for the
working directory of a skill script under `run_script` and of `run_monitor`.

`HOOK_PROJECT_DIR` replaces the project directory the host reports: `run_hook` gives it to Claude Code as
`CLAUDE_PROJECT_DIR` (and `run_script` does for a launcher, not for a skill script), which `hook_session_dir` reads. `hook_project_dir` reads
`CLAUDE_PROJECT_DIR` only when the fixture has no `cwd`, because a fixture's absolute `cwd` outranks it, as at
run time, even when that directory holds no `.git`. To point `hook_project_dir` at another project, put it in
the fixture's `cwd`, or send `"cwd":null` to exercise the `CLAUDE_PROJECT_DIR` path. `run_monitor` ignores
`HOOK_PROJECT_DIR` and the caller's working directory: use `--cwd`.

`run_monitor` fixes `CLAUDE_CODE_SESSION_ID` to `test-session`, so `monitor_once` marks the same session across
calls in one test; pass `CLAUDE_CODE_SESSION_ID=other` to start a new one.

`hook_has server <name>` asks about the plugin's MCP servers, not about any server the host has.

Tests run against `builds/`, not the source, so run `pluginfinity build` first. Run them with
`bats --recursive __test__`.

A hand-written fixture should set `hook_event_name`, as Claude Code's input does, but it only selects which
built entry `run_hook` runs. On both hosts the script's `PLUGINFINITY_EVENT` comes from that entry, not from the
input. When the script has no entry for the event, `run_hook` says so on stderr and uses the entries for any
event. Without an event in the input the hook library still reads `PLUGINFINITY_EVENT`, but a test then picks its
entry by chance, and a no-op can pass for the wrong reason. `hook_fixture` sets it for you.

The `load` path above assumes `pluginfinity` is installed in the plugin's own `node_modules`, as in a
workspace package that lists it as a devDependency. When it is installed only at the repository root,
such as a plugin folder that is not a workspace package, load it from there instead. Count one `..` per
directory between `__test__/` and the root, and keep the path in one shared file each test loads:

```bash
# plugin/__test__/common.bash, for a plugin at <root>/plugin/
load "$BATS_TEST_DIRNAME/../../node_modules/pluginfinity/bats/pluginfinity.bash"
```

```bash
# plugin/__test__/hooks.bats
load common
```
