# Session env

A plugin declares the session variables it keeps under `env` in the config. pluginfinity resolves them once
when a session starts. Every hook that sources `hook.sh` has them as plain shell variables, and a skill script
or monitor gets them by sourcing `env.sh`, on both hosts, with no per-plugin plumbing. A plain `command` hook
entry that does not source the library sees none of them.

## When to reach for it

Reach for `env` when a value is decided once per session and read in several places: a package manager
detected in the project, a feature switch a user sets in `.env`, a directory a later hook needs. It replaces
the hand-rolled pattern of a `SessionStart` hook that writes `export` lines to `CLAUDE_ENV_FILE` and a file
of its own, and reader hooks that source that file; see [migrating](#migrating-a-hand-rolled-session-env).

Do not use it for:

- **A fact in the event.** Read the payload with `hook_input`; it is fresher than anything stored.
- **Persistent state.** Values belong to one session and start again with the next. Keep caches and history
  in the data directory; see the `plugin-scripts` skill's State section.
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
file. Whether it always equals the hooks' `session_id` is not measured, so any other id falls back to the
project. Copilot sets no such variable for a script (its MCP server environment names none; a hook's is not
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

## Setting a value at run time

```bash
hook_env_set PFDOG_COLOR "$detected"
```

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
  Run `bash "{{skill_dir}}/scripts/print-env.sh"` and report its output.
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

## Testing

The bats helper reads and writes the library's own files under the test's state directory, so a test never
touches the user's sessions.

- **`--session-env <file>`** seeds the session's values as if `SessionStart` had run. The file holds
  `NAME=value` or `export NAME=value` lines, parsed and not sourced. `run_hook` seeds the fixture's
  `session_id`; `run_script` and `run_monitor` seed session `test-session` and point the project they run in at
  it (for a Claude Code script outside `skills/`, the project its `CLAUDE_PROJECT_DIR` names).
- **Seeds follow the run's state directory.** A call that passes its own `XDG_STATE_HOME` (a trailing
  `XDG_STATE_HOME=…` on `run_hook` or `run_monitor`, `--env XDG_STATE_HOME=…` on `run_script`, the last one
  winning) gets its seeded values, pointer and done marker there; otherwise they go under
  `$BATS_TEST_TMPDIR/state`.
- **An unseeded `SessionStart` hook does not wait.** `run_hook` writes the runner's done marker for the
  fixture's session, so the hook resolves live at once; pass `--env-wait` to keep the 3 second wait and test it.
- **`--env-file <file>`** on `run_script` puts a file's lines in the script's environment, as the exports a
  `SessionStart` hook wrote to `CLAUDE_ENV_FILE` are on Claude Code. They are ambient values (rung 5), not a
  session.
- **Nothing seeded** tests the live chain: defaults, then a `.env` you write into `$(_pf_project_dir)`.
- **The runner itself** runs like any hook, so a test can run it and then a reader, end to end. Pass
  `CLAUDE_ENV_FILE` on Claude Code to check what the model's shell would get.

From dogfood's `__test__/env.bats`:

```bash
setup() {
	printf 'PFDOG_COLOR=red\nexport PFDOG_SHAPE="triangle"\n' >"$BATS_TEST_TMPDIR/session.env"
}

@test "a reader hook puts a seeded session value into context, on both targets" {
	run_hook claude hooks/env-reader.sh posttooluse.env.json --session-env "$BATS_TEST_TMPDIR/session.env"
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood env: PFDOG_COLOR=red"
	run_hook copilot hooks/env-reader.sh posttooluse.env.json --session-env "$BATS_TEST_TMPDIR/session.env"
	assert_hook_json .additionalContext "pluginfinity-dogfood env: PFDOG_COLOR=red"
}

@test "a skill script takes the project's .env over the default" {
	local target project
	project=$(_pf_project_dir)
	printf 'PFDOG_LEVEL=7\n' >"$project/.env"
	for target in claude copilot; do
		run_script "$target" skills/env-probe/scripts/print-env.sh
		[ "$output" = $'PFDOG_COLOR=blue\nPFDOG_SHAPE=circle\nPFDOG_LEVEL=7' ]
	done
}
```

The runner, then a script, on both hosts:

```bash
@test "the setup script's values reach a skill script" {
	local target
	for target in claude copilot; do
		run_hook "$target" lib/pluginfinity/env-run.sh "$(hook_fixture SessionStart '{"source":"startup"}')" \
			CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/claude-env.sh"
		run_script "$target" skills/env-probe/scripts/print-env.sh
		[ "$output" = $'PFDOG_COLOR=green\nPFDOG_SHAPE=square\nPFDOG_LEVEL=1' ]
	done
	grep -qx "export PFDOG_COLOR='green'" "$BATS_TEST_TMPDIR/claude-env.sh"
}
```

## Debugging

Every problem is a line in `error.log` with the component and `env:`, never a failed hook. Read it with
`pluginfinity logs`, and `pluginfinity logs --debug` with `PLUGINFINITY_DEBUG=1` set for the reader's
`no session values; resolving live` lines and the setup script's stderr.

The files, under `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/`:

| Path | Holds |
| :-- | :-- |
| `session/<session id>/env` | One `NAME=value` line per declared name, the resolved value |
| `session/<session id>/set` | The names `hook_env_set` wrote |
| `session/<session id>/done` | Written when the runner has finished |
| `project/<key>` | The latest session id for one project, and the project's path |

An invalid session id (empty, `.`, holding `/`, `..`, a backslash or a control character) is logged and nothing is
read or written.

## Migrating a hand-rolled session env

A plugin-bot-era plugin, such as silk with its `source-session-env.sh`, shares values with three pieces: a
`SessionStart` hook that computes them and writes `export` lines to `CLAUDE_ENV_FILE` and to a
`~/.claude/session-env/<session_id>/<plugin>-hook.sh` file of its own, a `source_session_env "$session_id"`
call at the top of every reader hook, and, on Copilot, nothing. Replace all three:

1. **List the variables.** `grep -rn 'CLAUDE_ENV_FILE\|session-env\|source_session_env' hooks scripts skills`
   finds the producer and the readers; every name the producer exports becomes a `vars` entry. Drop names the
   library already answers: the plugin root is `hook_plugin_root`, and the session id is `hook_input session_id`.
   An old fallback becomes the `default`, except under these two rules:
   - **A name whose readers detect a value when it is empty gets `default: ""`.** A non-empty default fills the
     name whenever there is no values file, so the readers' detection never runs.
   - **Never declare a name that works as a deliberate per-command override**, such as a `*_PROJECT_DIR` a user
     sets for one command. Every declared name is resolved and exported, at worst as `""`, and on Claude Code
     appended to `CLAUDE_ENV_FILE`, which pins the model's shell to the session-start value. Leave such a name
     ambient-only: the scripts read it from their environment, as before.
2. **Move the computing into `setup`.** A function such as `detect_package_manager` moves to a script that
   prints `NAME=value` and is named as `env.setup`. A value only a hook can compute stays in that hook, which
   calls `hook_env_set NAME "$value"` instead of writing exports.
3. **Delete the plumbing.** Remove the exports to `CLAUDE_ENV_FILE`, the per-session file, its `grep -q`
   guards and `printf '%q'` quoting, the `source-session-env.sh` helper and every `source_session_env` call.
   Reader hooks use the names directly.
4. **Make skill scripts source `env.sh`.** A script that read `$MYPLUGIN_X` because Claude Code exported it now
   sources `env.sh` with the one line above, which makes it work on Copilot too.
5. **Check `SessionStart` timeouts.** Raise any under 5 seconds.
6. **Rewrite the tests.** Seed values with `--session-env` instead of writing `~/.claude/session-env/` files,
   and run every reader on both targets.
7. **Build and read the notes.** Copilot lists `env-shell-unsupported`; `env-wait-timeout` means step 5 is not
   done.

Behaviour that changes:

- The old reader sourced every `*hook*.sh` file in the session directory, other plugins' included. `env.sh`
  reads this plugin's declared names only, so a value another plugin exported no longer leaks in.
- The old files were shell code, sourced; the new ones are data, parsed, so a value can no longer run anything.
- A project's `.env` and `.env.local` now set declared names, above the setup script.
- Copilot gets the values in hooks and in skill scripts that source `env.sh`, where it got nothing before.
