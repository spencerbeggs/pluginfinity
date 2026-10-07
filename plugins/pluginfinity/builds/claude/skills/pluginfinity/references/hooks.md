# Hooks

Hooks are declared once, in the config's `hooks`, keyed by Claude Code event name. Each event holds a
list of entries; each entry is either a script or a command.

```ts
hooks: {
  SessionStart: [{ script: "hooks/session-start.sh", timeout: 5 }],
  PreToolUse: [{ matcher: "Bash", command: 'bash "${PLUGIN_ROOT}/hooks/guard.sh" --quiet' }],
},
```

## Entries

| Field | Meaning |
| :-- | :-- |
| `script` | A path from the plugin root. pluginfinity writes the command for each host |
| `args` | Arguments to a `script`, quoted for bash where they need it |
| `command` | A shell command as written. Its one placeholder is `${PLUGIN_ROOT}`, spelled each host's way |
| `matcher` | Which tools or sources the hook applies to, in Claude Code's terms. Where a host ignores it, the library applies it at run time; see [matchers a host ignores](#matchers-a-host-ignores) |
| `timeout` | Seconds, a positive whole number |
| `fallback` | What a host without the event does: `"fail"`, the default, or `"omit"` |
| `failClosed` | Deny or block when the script fails before answering. Defaults to failing open; see [when a hook fails](#when-a-hook-fails) |

An entry has exactly one of `script` or `command`.

## How scripts run

With `scripts.invoke: "bash"`, the default, a script entry runs through `bash`, so the file needs no
executable bit. On Claude Code it is written in exec form, `env K=V... bash <path> <args>`: `"command": "env"`
with the entry's `PLUGINFINITY_*` variables, `bash` and the script path in `args`, so no shell parses the path.
On Copilot it is the shell string `bash "<root>/<script>"`, with a
path the shell would read, such as one holding `$` or a space, single-quoted, and the variables in the
entry's `env` field. Running through `bash` suits
repositories that keep scripts in git without the executable bit. A `command` entry is written as the
shell string you gave, with the variables as an `export K='V';` prefix on Claude Code. With `"exec"`, the
command is the quoted path alone on Copilot, and `env K=V… <path>` on Claude Code when the entry has variables, and the build fails if the script is not executable. Under `"exec"` a
script path that contains `=` fails the build, because `env` would read it as a variable; a monitor's
script is exempt.

Every hook entry carries three facts as environment variables, so a script needs no host branch to learn
them: `PLUGINFINITY_EVENT` (the event, in Claude Code's spelling), `PLUGINFINITY_FAIL_CLOSED=1` when the
entry sets `failClosed`, and `PLUGINFINITY_MATCHER` when the host ignores the entry's matcher. A `command`
entry that does not source the library still gets them, but nothing reads them; see
[matchers a host ignores](#matchers-a-host-ignores).

The plugin root is `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Copilot. Copilot also
sets `CLAUDE_PLUGIN_ROOT` in a hook's environment, so a script can read either.

## The hook library

Every build with at least one hook gets a bash library under `hooks/lib/pluginfinity/`, and the shared
log library under `lib/pluginfinity/log.sh`. The hook library reads the
event, writes the response in each host's shape and keeps a crashing hook from blocking the host. A
script opts in by sourcing it first, with a path relative to the script:

```bash
# hooks/<name>.sh
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

# hooks/<event>/<name>.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
```

The library needs `jq` on the host's `PATH`; without it the hook is skipped and the reason is logged. It
also runs `cat`, `mktemp`, `rm`, `date`, `mkdir`, `basename`, `dirname` and `grep` (for a regex matcher checked at run time on Copilot), so a test that runs a hook
under a minimal `PATH` must keep all nine reachable. It is Bash 3.2 compatible and writes nothing when
sourced. Do not edit a copy under `builds/`: the next build
overwrites it.

### Reading the event

| Function | Prints |
| :-- | :-- |
| `hook_input <field>` | A field of the event's input by its Claude name. A dotted path such as `tool_input.command` reaches into nested keys. With no argument, the whole input as JSON. Nothing for a missing field. Empty or garbage stdin reads as `{}` |
| `hook_require_input` | Returns when stdin held a JSON object. Otherwise it logs, answers `hook_noop` and ends the script. Call it at the top level of the script: `exit` inside a subshell ends only the subshell |
| `hook_event` | The event name, in Claude Code's spelling, from `PLUGINFINITY_EVENT` or else the input's `hook_event_name`. Prints nothing and returns 1 when neither is known |
| `hook_host` | `claude` or `copilot` |
| `hook_plugin_root` | The build root the script runs from |
| `hook_project_dir` | Where this call runs, and never empty. In order: an absolute input `cwd` (a relative one is ignored) becomes the closest directory at or above it that holds `.git`, else that `cwd` itself; with no usable `cwd`, `CLAUDE_PROJECT_DIR` on Claude Code, else `$PWD` walked up to `.git` on Claude Code, else `$PWD` as is. On Copilot it is `$PWD` unchanged, never walked, which is the plugin root. A `cwd` in a directory with no `.git` therefore outranks `CLAUDE_PROJECT_DIR` |
| `hook_session_dir` | The session's project: `CLAUDE_PROJECT_DIR` on Claude Code when set, else `hook_project_dir`. In a git worktree the two differ |
| `hook_cd_project` | Changes into `hook_project_dir`. Prints nothing; when it cannot, it logs the reason with `hook_log` and returns 1 |
| `hook_tool_name <claude-name>` | The host's run-time spelling of a Claude Code tool name, such as `view` for `Read` on Copilot, or nothing and return 1 when the host has none. Name this plugin's own MCP tools `mcp__plugin_<plugin>_<server>__<tool>`. Read from the build's generated `tools.sh` |
| `hook_tool_prefix <server>` | The run-time prefix of one of this plugin's own MCP servers, to put in front of a tool name: `mcp__plugin_<claude plugin>_<server>__` on Claude Code, `<server>-` on Copilot. Prints nothing and returns 1 for a server the plugin does not declare |
| `hook_has <monitor\|skill\|agent\|server> <name>` | Succeeds when this host's build ships the component, so a skill a target leaves out, or a monitor on Copilot, answers 1. An unknown kind logs and returns 2. Read from the build's generated `tools.sh` |
| `hook_envelope claude` | The input as Claude Code would send it, as one line of JSON. On Copilot it renames `toolName`/`toolArgs` to `tool_name`/`tool_input`, snake_cases the other top-level keys, parses a string `tool_input` and maps Copilot's key names to Claude's where the Claude key is absent. It adds `hook_event_name` when missing. Any other argument logs and returns 1 |
| `hook_supports <capability> [event]` | Succeeds when the host honours the capability on the event, which defaults to the current one. `env-shell` asks whether a value set here reaches the model's shell: Claude Code in `SessionStart`, `Setup`, `CwdChanged` and `FileChanged`, never Copilot. `server-project` asks whether an MCP server of this plugin can learn the user's project, the question `server_project_dir` answers on the server side: it succeeds on Claude Code for any event, which gives a server `CLAUDE_PROJECT_DIR` and roots, and fails on Copilot, where a server has neither (measured 2026-10-07), so a hook can tell the model to pass the project in each tool call |

```bash
cmd=$(hook_input tool_input.command)     # a Bash tool's command
event=$(hook_event)                      # PreToolUse
host=$(hook_host)                        # claude
root=$(hook_plugin_root)                 # the build root
project=$(hook_project_dir)              # the user's project
if hook_supports context; then hook_context "hello"; fi
```

Copilot runs a hook with the plugin root as its working directory, not the user's project. A CLI that
finds its project from the working directory, such as one that walks up to a config file, would find the
plugin instead. Call `hook_cd_project` before running one:

```bash
hook_cd_project || { hook_noop; exit 0; }
if mytool check >/dev/null 2>&1; then
  hook_noop
else
  hook_context "mytool check failed in $(pwd)"
fi
```

`hook_input` reads stdin when the library is sourced, and caches it; read input only through `hook_input`. It accepts Copilot's camelCase payloads too (`toolName`,
`toolArgs` as an object or a JSON string), so `hook_input tool_input.command` works on both. The
capabilities are `context`, `deny`, `allow`, `ask`, `block`, `system_message`, `noop`, `raw`, `env-shell` and `server-project`.

A `tool_input` key is read by its Claude name on both hosts. Copilot keeps its own key names under Claude
event and tool names, so a lookup that finds nothing tries Copilot's spelling:

| Claude key | Copilot key |
| :-- | :-- |
| `file_path` | `path` |
| `content` | `file_text` |
| `old_string` | `old_str` |
| `new_string` | `new_str` |

`hook_input tool_input`, the whole object, is not aliased: on Copilot it carries Copilot's key names.

### Responding

Call one of these to answer the host. What each does depends on the host:

| Function | Claude | Copilot |
| --- | --- | --- |
| `hook_context "t"` | `hookSpecificOutput{hookEventName, additionalContext}` on SessionStart, SubagentStart, PostModelSwitch, UserPromptSubmit, UserPromptExpansion, PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch, Stop, SubagentStop; no-op (`{}`) elsewhere | flat `additionalContext` on SessionStart, SubagentStart, PostToolUse, Notification; no-op elsewhere (including UserPromptSubmit) |
| `hook_deny "r"` | `hookSpecificOutput{hookEventName: "PreToolUse", permissionDecision: deny, permissionDecisionReason}` | flat `permissionDecision: deny` + `permissionDecisionReason` |
| `hook_allow [reason] [json]` | `hookSpecificOutput{hookEventName: "PreToolUse", permissionDecision: allow}` (+ `permissionDecisionReason`, `updatedInput`) | `allow` (+ `permissionDecisionReason`, `modifiedArgs`) |
| `hook_ask "r"` | `hookSpecificOutput{hookEventName: "PreToolUse", permissionDecision: ask}` | `ask` (the cloud agent treats it as deny; documented) |
| `hook_block "r"` | top-level `decision: block` + `reason` on UserPromptSubmit, UserPromptExpansion, PostToolUse, PostToolBatch, Stop, SubagentStop, ConfigChange, PreCompact, TaskCreated, PreModelSwitch; no-op elsewhere | `decision: block` + `reason` on Stop, SubagentStop; no-op elsewhere |
| `hook_system_message "t"` | `systemMessage`, shown to the user and not added to model context; no-op on Notification, SessionEnd, PreCompact and ConfigChange, which discard it | no-op |
| `hook_relay "<json>"` | Maps one Claude-shaped response onto the helpers above; see below | the same |
| `hook_noop` | `{}` | `{}` |
| `hook_raw <host> <json>` | compacted and sent as is, only when `<host>` is `claude` | compacted and sent as is, only when `<host>` is `copilot` |

Use `hook_noop` to let a call proceed under normal permissions. `hook_allow` auto-approves, which skips the
permission prompt on Claude, so use it to approve or rewrite input deliberately.

`hook_allow [reason] [json]` takes the reason first, then the replacement input: an empty reason is
`hook_allow "" '<json>'`. The input is passed through as `updatedInput` or `modifiedArgs` unchanged, so on Copilot
write it with Copilot's key names (`path`, `file_text`, `old_str`, `new_str`). The second argument must be
valid JSON; otherwise the call logs the problem and returns 1, sending nothing. An older call that passed
the JSON as the only argument now passes it as the reason, so move it to the second argument.

`hook_relay` is for a script that hands the decision to a CLI that prints a Claude-shaped response. It picks
one answer, first match wins: a `permissionDecision` (`allow`, `deny` or `ask`, with its reason and
`updatedInput`), then `decision: "block"`, then `additionalContext`, then `systemMessage`, then `hook_noop`. It
calls the matching helper, so the host's rules apply, and writes each field it dropped to the debug log. Input
that is not a JSON object logs and returns 1.

```bash
hook_require_input
out=$(mytool hook --stdin <<<"$(hook_envelope claude)") || out='{}'
hook_relay "$out"
```

The rules:

- One response goes out per run. A second call is ignored, even from a subshell, and logged when debug is on.
- A call the host cannot honour on the current event becomes `{}` with exit 0, and logs a debug line when
  `PLUGINFINITY_DEBUG=1`. `hook_deny`, `hook_allow` and `hook_ask` work on `PreToolUse` only.
- `hook_raw <host> <json>` covers a field only one host has. The JSON is compacted and sent as is, and only
  when the host matches; on the other host it does nothing.
- The output caps (10,000 characters on Claude Code, 10 KB for `postToolUse` on Copilot) are not enforced.

```bash
cmd=$(hook_input tool_input.command)
case "$cmd" in
*rm\ -rf*) hook_deny "no recursive deletes" ;;
*) hook_noop ;;
esac
```

### Session env

When the config declares `env`, the library loads the session's values after the matcher check and before the
hook body, so every declared name is already a variable in the script. One function changes a value:

| Function | Does |
| :-- | :-- |
| `hook_env_set <NAME> <value>` | Sets a declared name for the rest of the session: writes the session's values file, exports it in this hook and, on Claude Code, appends `export NAME='value'` to `CLAUDE_ENV_FILE` for the model's shell. Only in `SessionStart`, `Setup`, `CwdChanged` and `FileChanged`, and only for a declared name with a one-line value; anything else changes nothing and logs. Always returns 0 |

```bash
pm=$(detect_pm)            # your own function
hook_env_set MYPLUGIN_PM "$pm"
hook_context "Package manager: $MYPLUGIN_PM"
```

The chain, the setup script, `.env` parsing, what each host's shell sees and the tests are in
[session env](session-env.md).

### When a hook fails

The library installs an `EXIT` trap. If the script exits non-zero, aborts under `set -e` or finds no `jq`, the
trap records the failure in the error log and exits 0, so the hook fails open. That matters on Copilot,
where a failing `preToolUse` hook denies the tool call.

- `hook_fail_closed`, or `failClosed: true` on the entry, makes the trap respond with a deny (`PreToolUse`)
  or a block (where the host honours one) instead. The entry form takes effect even when the script dies
  before it reaches a call, so prefer it for a guard. The call does nothing if the script already sent a
  response.
- **Fail closed only for a guard that must not let a call through when it breaks**, such as a hook that
  denies a destructive command or protects a path. Leave a hook that adds context, reacts to an edit or
  gates a Stop open: a crash there should cost one missing message, not a blocked session. On Copilot a
  closed guard on an event that can neither deny nor block still fails open.
- `exit 2` is a failure here, not a block. Use `hook_deny` or `hook_block` to refuse something.
- Only the response may reach stdout, and the library has no stdout fence. Redirect any CLI a hook runs (`>/dev/null` or `>&2`), or capture it with `$(...)`.
- Do not install your own `trap ... EXIT`. It replaces the library's trap, and a failing hook would then exit
  non-zero.
- A failing emitter, such as `hook_raw` or `hook_allow` given invalid JSON, logs the problem and returns 1. Under
  `set -e` that aborts into the same policy. Without `set -e` the script carries on after it.
- `hook_fail_closed` on `Stop` or `SubagentStop` still fails open when `stop_hook_active` is `true`, so a
  crashing hook cannot keep blocking in a loop.
- A failure while the library loads, such as a missing `host.sh`, exits 0 with a line in `error.log` and no `outcome:` debug line.
- Assign input to a variable before you use it: `cmd=$(hook_input tool_input.command)`, then `case "$cmd" in`.
  A failing `$(...)` inside a command's arguments or a `case` word does not trip `set -e`, so the script
  carries on with an empty value.

Every hook, server launcher, monitor and skill script logs through one standard, in
`${XDG_STATE_HOME:-~/.local/state}/pluginfinity/<plugin>/`. `error.log` holds failures. `debug.log` holds debug
lines, written only when `PLUGINFINITY_DEBUG=1`. A line is
`<ISO-8601 UTC> [<host>] <component>/<script>: <message>`, where the component is `hook`, `server`, `monitor` or
`script`. With the switch set, a hook also logs its raw input as an `input:` line and, when it exits, its result as one `outcome:` line: `block`, `deny`,
`allow`, `ask`, `context`, `system_message`, `noop`, `raw`, `none` (it sent no response), or `fail-closed deny` /
`fail-closed block` when the library sent the response for a crash. A non-zero exit code is appended, as in
`outcome: none (exit 3)`. A helper the host cannot honour on the event, such as `hook_deny` on `Stop`, sends `{}` and
logs `noop`: the outcome is what was sent, not what you asked for. A second response is ignored and the first
kind stays the outcome. If the library itself fails to load (no `jq`, or a missing `host.sh`), the hook exits 0, writes one `error.log` line (`host.sh not loadable; hook skipped` or `jq not found; hook skipped`) and writes no `outcome:` line. Use it to see what a host sends and what your hook answered.
`hook_log` and `hook_debug` append to the logs from your own script. The same files serve the other components:
see the `plugin-scripts` skill's logging section. `pluginfinity logs` prints them (`--debug` for `debug.log`, `--follow` to keep reading).

With `PLUGINFINITY_DEBUG=1`, prompts and tool inputs are written to a plaintext log. Do not leave it set
outside a debugging session.

### Matchers a host ignores

Claude Code applies an entry's `matcher`. Copilot ignores it on `SessionStart`, `SessionEnd` and
`SubagentStop`. For those events on Copilot the build hands the matcher to the script as
`PLUGINFINITY_MATCHER` and lists a `hook-matcher-runtime` note under `config`. The library then applies it
with Claude Code's rules, against `source`, `reason` and `agent_type` respectively: empty or `*` matches all, a value of only letters,
digits, `_`, `|`, spaces, `,` and `-` is an exact `|` list, and anything else is an unanchored extended
regular expression. A hook that does not match ends quietly with exit 0 and no response.

This holds **only for an entry whose script sources the library**. A plain `command` entry on such an event
gets the variable and the note, but nothing reads it, so on Copilot the hook runs for every source. Use a
`script` entry that sources `hook.sh` when the matcher matters.

Copilot reports a fresh session's `source` as `new`, where Claude Code says `startup` (Copilot CLI 1.0.92,
measured 2026-10-07). So on Copilot the build widens a `SessionStart` matcher list that holds `startup`: it
inserts `new` after it, `startup` becomes `startup|new` and `startup|resume` becomes `startup|new|resume`, and
lists a `hook-matcher-widened` note. Write `startup` as on Claude Code; never add `new` for Copilot yourself.
An empty or `*` matcher, a list that already holds `new` and a matcher without `startup` stay as written. A
regex that matches `startup` but not `new`, such as `^start`, is left alone with a `hook-matcher-regex` note:
widen it by hand, or write it as a list.

### Output a host ignores

Where a host discards a helper's output on an event, such as `hook_context` on a Copilot event it does not
read, the build lists a `hook-output-ignored` note naming the script and `<Event>:<helper>`. The scan is best
effort: it strips comments, reads whole-word helper names, does not model heredocs, cannot see a call made
through a variable or a sourced file, and skips events only Copilot has.

## Testing hooks

pluginfinity ships a bats helper that runs a plugin's built hook scripts the way each host runs them. Put
tests in `plugins/<name>/__test__/*.bats` and hand-written inputs in `__test__/fixtures/*.json`. Load the
helper at the top of each file:

```bash
load "$BATS_TEST_DIRNAME/../node_modules/pluginfinity/bats/pluginfinity.bash"
```

| Helper | Does |
| :-- | :-- |
| `run_hook <target> <script> <fixture> [--matcher <m>] [--session-env <file>] [--env-wait] [VAR=value...]` | Runs `builds/<target>/<script>` under `env -i` with that host's environment and the fixture on stdin, applying the environment of the built entry that runs the script. `--session-env` seeds the session values a reader sees, for the fixture's `session_id`. An unseeded `SessionStart` hook resolves at once, without the library's wait for the runner, unless `--env-wait` is given; see [session env](session-env.md#testing). Sets bats `$status`, `$output` and `$stderr`. A relative fixture is read from `__test__/fixtures/`. See below |
| `assert_hook_exit <n>` | The exit code is `n` |
| `assert_hook_json <jq-filter> <expected>` | The filter's raw value over stdout equals `expected` |
| `assert_hook_noop` | Exit 0 with no output or `{}` |
| `hook_fixture <event> [overrides-json]` | Writes a Claude-shaped input for the event to a temp file and prints its path |
| `run_script <target> <path> [--stdin <file>] [--cwd <dir>] [--env VAR=value]... [--env-file <file>] [--session-env <file>] [--interpreter <cmd>] [args...]` | Runs `builds/<target>/<path>` under `env -i`, with `node` for a `.mjs`, `.cjs` or `.js` script and `bash` for anything else (`--interpreter <cmd>` names another, `bash -x` included): a skill script or a launcher. A path under `skills/` gets what the agent's Bash tool gives a skill script: `PATH`, `HOME`, `XDG_STATE_HOME` and, on Claude Code, `CLAUDE_CODE_SESSION_ID=test-session`, but none of `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, `CLAUDE_SKILL_DIR` or `CLAUDE_ENV_FILE` (on Copilot nothing beyond the base: not measured there, assumed minimal). It runs from `--cwd` (default the test project, below) on both hosts. `--env-file` adds the `NAME=value` and `export NAME=value` lines of a file, parsed and not sourced, modelling the exports a SessionStart hook wrote to `CLAUDE_ENV_FILE`. `--session-env` seeds session `test-session` and points the script's project at it, so a script that sources `env.sh` reads the values. Any other path, a launcher, gets the host's plugin variables and keeps the plugin root as the Copilot directory. Stdin is `/dev/null` unless `--stdin` is given. Each `--env` adds one `VAR=value` and wins over `--env-file`; everything after the options, a bare `--` included, reaches the script as an argument. Sets `$status`, `$output` and `$stderr` |
| `run_monitor <target> <name> [--ticks <n>] [--timeout <seconds>] [--cwd <dir>] [--session-env <file>] [VAR=value...]` | Runs a monitor's command from `builds/claude/monitors/monitors.json` the way Claude Code starts it: from `--cwd` (default the test project, below), with `${CLAUDE_PLUGIN_ROOT}` substituted into the command text, none of `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` or `CLAUDE_SESSION_ID` set, `CLAUDE_CODE_SESSION_ID=test-session` and stdin `/dev/null`. Bounded to `<n>` ticks (default 1) through `PLUGINFINITY_MONITOR_MAX_TICKS`, and to `--timeout` seconds (default 30, at least 1) of wall-clock time: past it the process group is killed and `$status` is 124. `--session-env` seeds session values as for `run_script`. Any target but `claude` fails with status 1. See [monitors](monitors.md) |

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

## What ships

Every host gets the source `hooks/` directory whole, so a script can source helpers the config never
names, except scripts only another host's hooks run. Keep test data out of `hooks/`. A script outside
`hooks/` ships to the hosts that run it, as does any file a `command` names as `${PLUGIN_ROOT}/<path>`;
the build fails if one is missing. Clutter such as `.DS_Store` never ships.

pluginfinity also writes the hook library into every build with hooks, as `hooks/lib/pluginfinity/hook.sh`
plus a generated `host.sh` and `tools.sh` (the host's run-time tool names, read by `hook_tool_name`). The
log library goes to `lib/pluginfinity/log.sh`, and a config that declares `env` adds `lib/pluginfinity/env.sh`,
the runner `lib/pluginfinity/env-run.sh`, and ships the `env.setup` script. The library paths are reserved: a source file under `hooks/lib/pluginfinity/` fails
the build, and `build --check` reports a library from a different pluginfinity version as drift.

pluginfinity writes the hooks file itself: `hooks/hooks.json` on Claude Code and
`com.github.copilot/hooks/hooks.json` on Copilot. A source file at either path fails the build.

## Events across hosts

Copilot runs a hook declared under a Claude Code event name it shares, with a Claude-shaped payload.
These have that form: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `PermissionRequest`, `Stop`, `SubagentStop` and `PreCompact`. `SubagentStart`
and `Notification` map to Copilot's `subagentStart` and `notification`. Copilot has no other Claude
Code event.

An event a host lacks fails the build unless every entry for it sets `fallback: "omit"`, which skips it
there and lists it as a `hook-omitted` note under that host's line in the build output. To give one host a different script for an event, override that event under the host's key in the
config.

Every Copilot entry the build writes carries `env: { PLUGINFINITY_EVENT: "<Claude event name>" }`, which
the library reads for `hook_event`, because camelCase payloads carry no event name.

Host notes from live runs:

- Copilot puts `SubagentStart` context at the top of the subagent's first prompt.
- Copilot also fires `UserPromptSubmit` for a subagent's prompt, under the subagent's own session id.
- Claude Code 2.1.288 shows a `UserPromptSubmit` `systemMessage` in the UI ("UserPromptSubmit says: ...") and
  does not add it to model context.

The library prints each host's output shape for you. For a field only one host has, use
`hook_raw <host> <json>`, which sends the JSON on that host and does nothing on the other.
