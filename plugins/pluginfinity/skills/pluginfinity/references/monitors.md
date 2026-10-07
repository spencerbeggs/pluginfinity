# Monitors

A monitor is a background process the host starts with the plugin. Each line it prints to stdout reaches
the model as a notification. Only Claude Code has monitors: on Copilot the build drops every monitor and
lists a `monitor-omitted` note under `config` for each, and ships no monitors file or monitor script.

## Declare one

Monitors are declared once in the config, keyed by a kebab-case name:

```ts
monitors: {
  heartbeat: {
    script: "monitors/heartbeat.sh",
    description: "Notifies once per session that the dogfood heartbeat is alive",
  },
  "skill-watch": {
    script: "monitors/skill-watch.sh",
    description: "Notifies once when the hook-eval skill is invoked",
    when: "on-skill-invoke:hook-eval",
  },
},
```

| Field | Meaning |
| :-- | :-- |
| `script` | A path from the plugin root. The build writes the command and ships the script. Exactly one of `script` or `command` |
| `args` | Arguments to a `script` |
| `command` | A shell command as written. Its one placeholder is `${PLUGIN_ROOT}`, and a file it names after that ships |
| `description` | What the monitor watches, shown by the host. Required |
| `when` | `"always"`, the default, or `on-skill-invoke:<skill>`, which starts the monitor the first time that skill is invoked. Write the bare skill name; the build qualifies it as `<plugin>:<skill>` for Claude. A skill the plugin does not build fails the build |

A target's own `monitors` replaces the base monitor of the same name on that host. The build writes
`monitors/monitors.json` on Claude Code, with each entry's `name`, `command`, `description` and `when`. A
source file at that path fails the build with `reserved-monitors-file` whenever the target builds monitors, whether
`files` ships it or not. Copilot builds none, so it is unaffected, and a plugin with no `monitors` field still
ships a `monitors/monitors.json` it wrote itself. Each command sets `PLUGINFINITY_MONITOR=<name>`, which the
library logs under. The command is written one of two ways, with the value single-quoted:

| Entry | Command in `monitors.json` |
| :-- | :-- |
| `script` | `PLUGINFINITY_MONITOR='<name>' bash "${CLAUDE_PLUGIN_ROOT}/<script>" <args>` |
| `command` | `export PLUGINFINITY_MONITOR='<name>'; <command>` |

A `command` entry that holds `${PLUGIN_ROOT}` in the config needs the same Biome
`noTemplateCurlyInString` ignore as a server `command`: keep it a plain string and put
`// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder` on the line above.

**Measured on Claude Code 2.1.292:**

- A monitor starts in the project directory, with the launching shell's environment.
- `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_SESSION_ID` are all unset, so
  `monitor_project_dir` falls back to the git toplevel, and a script must not read the others. `${CLAUDE_PLUGIN_ROOT}`
  in the command text is still substituted by the host.
- `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID`, `CLAUDE_CODE_CHILD_SESSION=1` and `CLAUDE_CODE_ENTRYPOINT=cli` are set.
  `monitor_once` scopes its marker by `CLAUDE_CODE_SESSION_ID`, then `CLAUDE_SESSION_ID`, then the monitor's parent pid.
- Claude matches `on-skill-invoke` against the plugin-qualified skill name, which the build writes for you. The monitor starts on the slash command or on a model Skill-tool dispatch; a bare name never matched.

## The monitor library

The build writes `lib/pluginfinity/monitor.sh` into each build that has monitors. It is POSIX `sh`, and it
writes to stdout only through `monitor_notify`: one line on stdout is one notification. A monitor script
sets `_pf_lib_dir` to the library's directory, sources it, then calls the functions. From a script at
`monitors/<name>.sh`:

```sh
#!/bin/sh
set -eu
_pf_lib_dir="$(dirname "$0")/../lib/pluginfinity"
. "$_pf_lib_dir/monitor.sh"

beat() {
	monitor_once heartbeat "$(monitor_name) is alive"
}

monitor_every 60 beat
```

`_pf_log_dir` works in place of `_pf_lib_dir`, the convention `log.sh` uses. POSIX `sh` cannot find a
sourced file's own path, so one of them must be set first. Without a readable `log.sh` beside it the
monitor still runs and the logging functions do nothing.

| Function | Does |
| :-- | :-- |
| `monitor_notify <text...>` | Prints one line, newlines turned into spaces. Returns 1 when stdout is closed. Empty text is ignored |
| `monitor_once <key> <text...>` | `monitor_notify`, but only the first time `<key>` is seen this session |
| `monitor_every <seconds> <function>` | Calls the function now and every `<seconds>`, forever. A failing call is logged and the loop goes on. A closed stdout ends it with exit 0. A non-numeric interval logs and uses 60 |
| `monitor_name` | `PLUGINFINITY_MONITOR`, else the script's name |
| `monitor_host`, `monitor_plugin_root`, `monitor_project_dir` | The host, the build root, and `CLAUDE_PROJECT_DIR` else the git root else `$PWD` |
| `monitor_state_dir` | `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/monitor/<name>/`, created |
| `monitor_log <message>`, `monitor_debug <message>` | Append to `error.log`, or to `debug.log` when `PLUGINFINITY_DEBUG=1`, with component `monitor` |

- **Call `monitor_notify` directly from the polled function.** Inside `$(...)` or a pipeline it runs in a
  subshell, which cannot tell `monitor_every` that stdout closed, so the loop would never stop.
- **A monitor never exits non-zero for an error inside one poll.** The library logs it and the loop goes on.
- **Print nothing else to stdout.** A stray line is a notification.
- **`PLUGINFINITY_MONITOR_MAX_TICKS=<n>` is a contract every monitor honours: stop after `n` polls.** The
  monitor library does it in `monitor_every`. A monitor that does not use the library, such as a `command`
  that runs `node`, must read the variable itself and exit after `n` polls, or `run_monitor` never returns. Only
  a test sets it; never set it in a plugin.

## Test one

`run_monitor <target> <name> [--ticks <n>] [--cwd <dir>] [VAR=value...]` runs the monitor's command from the
built `monitors.json` under `bash -c`, bounded to `n` ticks (default 1) by `PLUGINFINITY_MONITOR_MAX_TICKS`, and
sets `$status`, `$output` and `$stderr`. It starts in `--cwd` (default `$BATS_TEST_TMPDIR/project`, created),
substitutes `${CLAUDE_PLUGIN_ROOT}` into the command text, and gives the monitor the environment Claude Code
does: none of `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` or `CLAUDE_SESSION_ID`, and
`CLAUDE_CODE_SESSION_ID=test-session`. Only `claude` has monitors: another target, or a missing monitor,
fails with status 1.

```bash
@test "the heartbeat notifies once and logs where it started" {
	run_monitor claude heartbeat --ticks 2 PLUGINFINITY_DEBUG=1 PLUGINFINITY_PLUGIN=my-plugin PLUGINFINITY_HOST=claude
	assert_hook_exit 0
	[ "$output" = "heartbeat is alive" ]
}

@test "copilot builds no monitors" {
	[ ! -e "$BATS_TEST_DIRNAME/../builds/copilot/monitors" ]
}
```

Two ticks print one line because `monitor_once` keys on the session.
