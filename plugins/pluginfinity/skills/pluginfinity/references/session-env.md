# Session env

A plugin declares the session variables it keeps under `env` in the config. pluginfinity resolves them once
when a session starts. Every hook that sources `hook.sh` has them as plain shell variables, a native hook reads one with
`h.env("NAME")`, and a skill script or monitor gets them by sourcing `env.sh`, on both hosts, with no per-plugin
plumbing. A plain `command` hook
entry that does not source the library sees none of them.

## When to reach for it

Reach for `env` when a value is decided once per session and read in several places: a package manager
detected in the project, a feature switch a user sets in `.env`, a directory a later hook needs. It replaces
the hand-rolled pattern of a `SessionStart` hook that writes `export` lines to `CLAUDE_ENV_FILE` and a file
of its own, and reader hooks that source that file; see [migrating](session-env-migrating.md).

Do not use it for:

- **A fact in the event.** Read the payload with `hook_input`, or `h.input` in a native hook; it is fresher than anything stored.
- **Persistent state.** Values belong to one session and start again with the next. Keep caches and history
  in the data directory; see the State section of the `bash-hooks` skill's scripts reference.
- **Secrets.** Values sit in plain files under the state directory and, on Claude Code, in the shell the model
  runs commands in.
- **Several lines.** A value is one line; a value holding a newline is refused.

## Declare the variables

```ts
env: {
  prefix: "PFDOG",
  vars: {
    PFDOG_COLOR: { default: "blue", description: "Set by the setup script" },
    PFDOG_SHAPE: { default: "circle", description: "Set by the setup script" },
    PFDOG_LEVEL: { default: "1", description: "Only the config default" },
  },
  setup: "scripts/env-setup.sh",
},
```

| Field | Meaning |
| :-- | :-- |
| `vars` | The declared names, each with an optional `default` (a string, `""` when absent) and `description` (for people reading the config). Only these names are ever read or written |
| `prefix` | Optional. Every declared name must then start with `<prefix>_` |
| `setup` | Optional. A plugin-relative script whose output sets values at session start; see [the setup script](#the-setup-script). It ships to every target |

- A name is upper-case letters, digits and `_`, not starting with a digit. `PATH`, `IFS`, `HOME`, `PWD`,
  `XDG_STATE_HOME`, `TMPDIR`, `SHELL`, `BASH_ENV`, `ENV`, `CDPATH`, `SHELLOPTS`, `BASHOPTS`, `PS4` and every name
  starting `PLUGINFINITY_`, `_PF_`, `CLAUDE_`, `COPILOT_`, `LD_` or `DYLD_` are reserved and fail the config with
  `ConfigInvalid`, as does a name outside the `prefix`.
- A `default` is one line with no control character but tab.
- A missing `setup` script fails the build with `HookScriptInvalid`. It runs under `bash`, so it needs no
  executable bit.
- `env` has no per-target override: both hosts get the same variables.
- Values are strings, with no types. A script that wants a number checks the string itself.

The build writes `lib/pluginfinity/env.sh`, holding the names and defaults, and the runner
`lib/pluginfinity/env-run.sh` into each target, and adds the runner as the first `SessionStart` entry, with no
matcher and a 15 second timeout, so it runs on every source: `startup`, `resume`, `clear`, `compact`, and
Copilot's `new`. A plugin with no `SessionStart` hooks gets the event for it.

## Where a value comes from

Lowest first; a later rung wins:

1. the `default` in the config
2. the setup script's output
3. `<project>/.env`
4. `<project>/.env.local`
5. the ambient environment: a declared name already set in the process environment
6. `hook_env_set` at run time

**Resolved once, at SessionStart.** The runner evaluates rungs 1 to 5 once and writes the resolved value of
every declared name to the session's values file. A later reader takes that file as the answer and does not
read `.env` again, so an edit to `.env` mid-session shows up in the next session, not this one. Only
`hook_env_set` changes a value after that. A reader with no values file at all, such as a script run outside
any session or before the first `SessionStart`, evaluates rungs 1, 3, 4 and 5 live, without the setup script.

**`.env` and `.env.local` are parsed, never sourced.** A line is `NAME=value` or `export NAME=value`. One pair
of surrounding single or double quotes is stripped and nothing inside is expanded, so `$HOME` stays the five
characters `$HOME`. Comments, blank lines and anything else are skipped. Only declared names are read, so a
project's `.env` full of unrelated keys is harmless. The project is the event's `cwd` walked up to its git
root.

## The setup script

The setup script computes values from the project, such as a package manager from a lockfile. It prints
`NAME=value` lines on stdout:

```bash
#!/usr/bin/env bash
# Session env setup for the dogfood plugin: prints NAME=value lines for declared variables.
echo "PFDOG_COLOR=green"
echo "PFDOG_SHAPE=square"
```

- It runs once per `SessionStart`, on every source, under `bash`, with the project as its working directory,
  the hook environment plus `PLUGINFINITY_EVENT=SessionStart`, and the event JSON on stdin.
- Blank lines and `#` lines are ignored. A value is literal to the end of the line, spaces and `=` included.
  A later line for the same name wins.
- A name the config does not declare is skipped, with one `error.log` line each.
- It has 10 seconds. On timeout it and every process it started are stopped, nothing it printed is kept, and
  `error.log` says so. A non-zero exit keeps the valid lines it printed and logs the exit code. Neither ever
  fails the session.
- With no project, as on a Copilot event that carries no `cwd`, it is skipped with a log line; the defaults and
  the ambient environment still resolve.
- Its stderr is not shown. With `PLUGINFINITY_DEBUG=1` its first 20 lines go to `debug.log`.
- It does not get the hook library: no `hook_input`, no `hook_log`. Keep it to computing values. A value that
  depends on a hook's own logic is set from that hook with `hook_env_set`.

## Reading the values

**A hook that sources `hook.sh` needs no call.** A plain `command` entry gets nothing. The hook library loads the session's values after the matcher check and before the
hook body, so a declared name is just a variable:

```bash
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input
# The library has applied the session env before this line, so a declared name is just a variable.
pattern=$(hook_input tool_input.pattern)
case "$pattern" in
*pf-dogfood-env*) hook_context "pluginfinity-dogfood env: PFDOG_COLOR=$PFDOG_COLOR" ;;
*) hook_noop ;;
esac
```

Every declared name is exported, set to `""` at worst, so `set -u` is safe.

**A skill script or a monitor sources `env.sh`**, which applies the values to its shell. Build the library path as
an absolute directory, before any `cd`, because a relative `$0` resolves against the working directory and stops
finding the library after a `cd`:

```bash
_pf_lib_dir="$(cd "$(dirname "$0")/../../../lib/pluginfinity" && pwd)"   # skills/<skill>/scripts/x.sh
# shellcheck source=/dev/null
. "$_pf_lib_dir/env.sh"
```

A monitor at `monitors/x.sh` uses `../lib/pluginfinity`. The `# shellcheck source=/dev/null` line keeps SC1091
quiet, since shellcheck cannot follow a path built at run time. Add one `..` per extra directory between the
script and the plugin root.

A script that resolves its own project, such as one that `cd`s into a directory it finds, sources `env.sh` in
manual mode: `_pf_env_manual=1` before the source skips the automatic load, and the script calls `env_load`
itself once it knows the project.

```bash
_pf_lib_dir="$(cd "$(dirname "$0")/../../../lib/pluginfinity" && pwd)"
_pf_env_manual=1
# shellcheck source=/dev/null
. "$_pf_lib_dir/env.sh"
cd "$PROJECT_DIR" || exit 1
env_load "" "$PROJECT_DIR"
```

Sourcing after the `cd` works only because `_pf_lib_dir` is already absolute.

`env.sh` is POSIX `sh`, writes nothing
to stdout and never fails the script. It also loads `log.sh`, so `script_log` works after it. A monitor sources
`monitor.sh` first, so its log lines carry the `monitor` component.

A script is not handed a session id the way a hook is. On Claude Code a skill script and a monitor get
`CLAUDE_CODE_SESSION_ID`, and `env.sh` reads that session when the id is valid and the session has a values
file. It equals the hooks' `session_id` (measured on Claude Code 2.1.291, 2026-10-07), so the project pointer is
only the fallback when that session has no values file. Copilot sets no such variable for a script (its MCP server environment names none; a hook's is not
measured), so there `env.sh` always finds the session through the project: the runner records, per project, the
latest session that started there. The project is `CLAUDE_PROJECT_DIR` when set, else the working directory,
walked up to its git root. Two consequences:

- **Run the script from inside the project.** An agent's working directory is wherever it last went; from
  outside the project a script with no session of its own finds none and resolves live (defaults, that
  directory's `.env`, the ambient environment).
- **Two sessions in one project share the pointer.** On Copilot, and on Claude Code when
  `CLAUDE_CODE_SESSION_ID` names no values file, a script reads the session that started there last.

`env_reload` loads the values again. A monitor that runs for the whole session calls it in each tick to pick up
a `hook_env_set` made after it started.

**A native hook calls `h.env`.** It resolves the same chain and reads the same session values file, so a bash
hook and a native one in one plugin agree:

```zig
const color = h.env("PFDOG_COLOR") orelse "none";
```

`h.env` returns null for a name the config does not declare. Give a `SessionStart` entry that reads one a
`timeout` of 5 or more, as for a script.

## Setting a value at run time

```bash
hook_env_set PFDOG_COLOR "$detected"
```

A native hook calls `h.envSet("PFDOG_COLOR", detected)`, with the same rules and the same file, so either kind
of hook reads what the other set.

`hook_env_set NAME value` is rung 6. It writes the session's values file, exports the name in the calling hook,
and on Claude Code appends `export NAME='value'` to `CLAUDE_ENV_FILE`, so the model's shell sees it too.

- It works only in the events that can produce a value: `SessionStart`, `Setup`, `CwdChanged` and
  `FileChanged`. Elsewhere it changes nothing and writes a `debug.log` line. Of the four, Copilot runs only
  `SessionStart`.
- Only a declared name, and only a one-line value. Anything else changes nothing and writes an `error.log`
  line, as does a build that declares no `env`.
- It always returns 0. A refusal never aborts a `set -e` hook or trips `failClosed`, so check `error.log`, not
  the status.
- A value set in `SessionStart` survives the runner, even when the runner finishes later: a rerun under the same
  session id, as after a compaction, keeps every name `hook_env_set` wrote and re-resolves the rest. A resumed
  session with a new session id starts from a fresh values file.

## What the model's shell sees

The model's own shell commands, and a skill script it runs through its Bash tool, are not hooks.

| | Claude Code | Copilot |
| :-- | :-- | :-- |
| Hooks that source `hook.sh` | Every declared name, through `env.sh` | The same |
| The model's shell | Every declared name: the runner and `hook_env_set` append `export` lines to `CLAUDE_ENV_FILE` | Nothing: Copilot has no such channel |
| A skill script that sources `env.sh` | Every declared name | Every declared name |
| `hook_supports env-shell` | Succeeds in `SessionStart`, `Setup`, `CwdChanged` and `FileChanged` | Fails |

On Claude Code an export in `CLAUDE_ENV_FILE` reaches the Bash tool and no later hook (Claude Code 2.1.292,
measured 2026-10-07), which is why hooks read `env.sh` on both hosts. Copilot's build lists an
`env-shell-unsupported` note under `config` to say a skill script must source `env.sh` there.

So **never tell the model to read `$NAME` in its own shell**: that works on Claude Code and is empty on
Copilot. Give it a script that sources `env.sh`, or put the value in context from a hook. A hook that wants to
mention the variable by name can ask:

```bash
# In a SessionStart hook: env-shell succeeds only in the events that can set a value.
if hook_supports env-shell; then
  hook_context "The package manager is in \$MYPLUGIN_PM."
else
  hook_context "The package manager is $MYPLUGIN_PM."
fi
```

## SessionStart hooks run beside the runner

Claude Code runs an event's hooks in parallel, so being first in the list does not make the runner finish first.
In `SessionStart` only, a hook that finds no values file yet waits up to 3 seconds for the runner, then resolves
live and logs `the env runner had not finished after 3s; resolving live`. Other events never wait.

- **Give every `SessionStart` entry a `timeout` of at least 5**, or none. An entry under 5 seconds gets an
  `env-wait-timeout` note, since the host could kill it while it waits.
- A slow setup script makes a parallel `SessionStart` hook resolve without it. A hook that needs the setup's
  value at startup should compute it itself, or the value should come from `.env` or a default.

## Worked example: the dogfood plugin

pluginfinity's dogfood fixture, `plugins/dogfood`, carries the whole pattern:

- The config declares three names under the `PFDOG` prefix and the setup script, as in
  [declare the variables](#declare-the-variables).
- `scripts/env-setup.sh` prints `PFDOG_COLOR=green` and `PFDOG_SHAPE=square`, as in
  [the setup script](#the-setup-script). `PFDOG_LEVEL` keeps its default unless the project's `.env` sets it.
- `hooks/env-reader.sh`, a `PostToolUse` entry on `Grep`, puts `PFDOG_COLOR` into context, as in
  [reading the values](#reading-the-values).
- The `env-probe` skill tells the model to run its script from the skill directory:

  ```markdown
  Run `bash "\{{skill_dir}}/scripts/print-env.sh"` and report its output.
  ```

  and the script sources `env.sh`, so it prints the session's values on both hosts:

  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  _pf_lib_dir="$(cd "$(dirname "$0")/../../../lib/pluginfinity" && pwd)"
  . "$_pf_lib_dir/env.sh"
  printf 'PFDOG_COLOR=%s\nPFDOG_SHAPE=%s\nPFDOG_LEVEL=%s\n' "$PFDOG_COLOR" "$PFDOG_SHAPE" "$PFDOG_LEVEL"
  ```

So the reader hook should say `PFDOG_COLOR=green` on both hosts, and the probe should print green, square and
1; dogfood's `__test__/env.bats` checks exactly that against both builds, with the runner and the setup script
run as each host runs them. On Claude Code `echo $PFDOG_COLOR` in the model's shell should print green too, and
on Copilot nothing. No live session has confirmed this yet.

## Testing, debugging and migrating

- Read [testing and debugging session env](session-env-testing.md) before you write a test for a reader or a
  setter, or when a value is wrong at run time.
- Read [migrating a hand-rolled session env](session-env-migrating.md) when a plugin writes `CLAUDE_ENV_FILE`
  or a per-session file of its own.
