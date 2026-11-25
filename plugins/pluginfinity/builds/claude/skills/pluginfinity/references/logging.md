# Logging

Every part of a plugin logs through one standard: bash hooks, native hooks, server launchers, monitors and
skill scripts. Read this when a hook or script needs to log, or when you need to find out what one did.

## The files

A line goes to `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/` as
`<ISO-8601 UTC> [<host>] <component>/<script>: <message>`. The component is `hook`, `server`, `monitor` or
`script`, and `<script>` is the script's or program's own file name.

| File | Holds |
| :-- | :-- |
| `error.log` | Failures, always written |
| `debug.log` | Debug lines, written only when `PLUGINFINITY_DEBUG=1` |

`PLUGINFINITY_DEBUG=1` is the one debug switch for all of them. It also logs each hook's raw input, which can
hold prompts and tool inputs in plaintext, so unset it after a debugging session.

## Writing a line

| From | Calls | Covered in |
| :-- | :-- | :-- |
| A bash hook | `hook_log`, `hook_debug` | the `bash-hooks` skill's [library](${CLAUDE_PLUGIN_ROOT}/skills/bash-hooks/references/library.md) |
| A native hook | `h.log`, `h.debug` | the `native-hooks` skill's [API](${CLAUDE_PLUGIN_ROOT}/skills/native-hooks/references/api.md#logging) |
| A server launcher | `server_log`, `server_debug` | the `bash-hooks` skill's [scripts outside hooks](${CLAUDE_PLUGIN_ROOT}/skills/bash-hooks/references/scripts.md#server-launchers) |
| A monitor | `monitor_log`, `monitor_debug` | [monitors](monitors.md) |
| A skill script | `script_log`, `script_debug` | the `bash-hooks` skill's [scripts outside hooks](${CLAUDE_PLUGIN_ROOT}/skills/bash-hooks/references/scripts.md#logging-from-a-skill-script) |

Never write a log file of your own, and never log to stdout: a hook's stdout is its answer, a server's is its
protocol and a monitor's is what the model reads.

## Reading the logs

`pluginfinity logs` prints them.

- Inside a plugin it reads that plugin's logs. `--plugin <name>`, which may repeat, names others. Outside any
  plugin, with no `--plugin`, it reads every plugin that has logs.
- It prints the last 50 lines of each plugin's `error.log`. `--lines <n>` changes the count; a negative one is
  a usage error, exit 64.
- `--debug` shows `debug.log` instead.
- `--follow` (`-f`) keeps printing new lines until Ctrl-C, which is how to watch a live session's hooks fire.
- Under `--agent` or `--ci` it prints one JSON object, or one entry per line while following. Run from an
  agent's shell it detects the agent and prints JSON; `--human` gives the sections.

## What a hook logs for you

With the switch set, a hook written on either library logs its raw input as an `input:` line and, when it
exits, its result as one `outcome:` line. The bash library's outcomes and what each means are in its
[library](${CLAUDE_PLUGIN_ROOT}/skills/bash-hooks/references/library.md#when-a-script-fails) reference.

A plugin from an earlier pluginfinity that reads a different log file or sets a different debug variable
needs updating to these.
