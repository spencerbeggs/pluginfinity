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
| `matcher` | Which tools or sources the hook applies to, in Claude Code's terms |
| `timeout` | Seconds, a positive whole number |
| `fallback` | What a host without the event does: `"fail"`, the default, or `"omit"` |
| `failClosed` | Deny or block when the script fails before answering. Defaults to failing open |

An entry has exactly one of `script` or `command`.

## How scripts run

With `scripts.invoke: "bash"`, the default, a script entry runs through `bash`, so the file needs no
executable bit. On Claude Code it is written in exec form, `"command": "env"` with the entry's `PLUGINFINITY_*`
variables, `bash` and the script path in `args`, so no shell parses the path. On Copilot it is the shell string `bash "<root>/<script>"`, with a
path the shell would read, such as one holding `$` or a space, single-quoted. Running through `bash` suits
repositories that keep scripts in git without the executable bit. A `command` entry is written as the
shell string you gave. With `"exec"`, the
command is the quoted path alone, and the build fails if the script is not executable.

The plugin root is `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Copilot. Copilot also
sets `CLAUDE_PLUGIN_ROOT` in a hook's environment, so a script can read either.

## The hook library

Every build with at least one hook gets a bash library under `hooks/lib/pluginfinity/`. It reads the
event, writes the response in each host's shape and keeps a crashing hook from blocking the host. A
script opts in by sourcing it first, with a path relative to the script:

```bash
# hooks/<name>.sh
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

# hooks/<event>/<name>.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
```

The library needs `jq` on the host's `PATH`; without it the hook is skipped and the reason is logged. It
also runs `cat`, `mktemp`, `rm`, `date`, `mkdir`, `basename` and `dirname`, so a test that runs a hook
under a minimal `PATH` must keep all eight reachable. It is Bash 3.2 compatible and writes nothing when
sourced. Do not edit a copy under `builds/`: the next build
overwrites it.

### Reading the event

| Function | Prints |
| :-- | :-- |
| `hook_input <field>` | A field of the event's input by its Claude name. A dotted path such as `tool_input.command` reaches into nested keys. With no argument, the whole input as JSON. Nothing for a missing field |
| `hook_event` | The event name, in Claude Code's spelling |
| `hook_host` | `claude` or `copilot` |
| `hook_plugin_root` | The build root the script runs from |
| `hook_project_dir` | `CLAUDE_PROJECT_DIR` on Claude Code. On Copilot, the closest directory above the input's `cwd` that holds `.git`, else the `cwd` |
| `hook_cd_project` | Changes into `hook_project_dir`. Prints nothing; when it cannot, it logs the reason with `hook_log` and returns 1 |
| `hook_supports <capability> [event]` | Succeeds when the host honours the capability on the event, which defaults to the current one |

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
capabilities are `context`, `deny`, `allow`, `ask`, `block`, `system_message`, `noop` and `raw`.

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
| `hook_allow [json]` | `hookSpecificOutput{hookEventName: "PreToolUse", permissionDecision: allow}` (+ `updatedInput`) | `allow` (+ `modifiedArgs`) |
| `hook_ask "r"` | `hookSpecificOutput{hookEventName: "PreToolUse", permissionDecision: ask}` | `ask` (the cloud agent treats it as deny; documented) |
| `hook_block "r"` | top-level `decision: block` + `reason` on UserPromptSubmit, UserPromptExpansion, PostToolUse, PostToolBatch, Stop, SubagentStop, ConfigChange, PreCompact, TaskCreated, PreModelSwitch; no-op elsewhere | `decision: block` + `reason` on Stop, SubagentStop; no-op elsewhere |
| `hook_system_message "t"` | `systemMessage`, shown to the user and not added to model context; no-op on Notification, SessionEnd, PreCompact and ConfigChange, which discard it | no-op |
| `hook_noop` | `{}` | `{}` |
| `hook_raw <host> <json>` | compacted and sent as is, only when `<host>` is `claude` | compacted and sent as is, only when `<host>` is `copilot` |

Use `hook_noop` to let a call proceed under normal permissions. `hook_allow` auto-approves, which skips the
permission prompt on Claude, so use it to approve or rewrite input deliberately.

`hook_allow '<json>'` passes `updatedInput` or `modifiedArgs` through unchanged, so on Copilot write the
replacement input with Copilot's key names (`path`, `file_text`, `old_str`, `new_str`). The argument must be
valid JSON; otherwise the call logs the problem and returns 1, sending nothing.

The rules:

- One response goes out per run. A second call is ignored, even from a subshell, and logged when debug is on.
- A call the host cannot honour on the current event becomes `{}` with exit 0, and logs a debug line when
  `PLUGINFINITY_HOOK_DEBUG=1`. `hook_deny`, `hook_allow` and `hook_ask` work on `PreToolUse` only.
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

### When a hook fails

The library installs an `EXIT` trap. If the script exits non-zero, aborts under `set -e` or finds no `jq`, the
trap records the failure in the error log and exits 0, so the hook fails open. That matters on Copilot,
where a failing `preToolUse` hook denies the tool call.

- `hook_fail_closed` makes the trap respond with a deny (`PreToolUse`) or a block (where the host honours
  one) instead. Call it early. It does nothing if the script already sent a response.
- `exit 2` is a failure here, not a block. Use `hook_deny` or `hook_block` to refuse something.
- Only the response may reach stdout, and the library has no stdout fence. Redirect any CLI a hook runs (`>/dev/null` or `>&2`), or capture it with `$(...)`.
- Do not install your own `trap ... EXIT`. It replaces the library's trap, and a failing hook would then exit
  non-zero.
- A failing emitter, such as `hook_raw` or `hook_allow` given invalid JSON, logs the problem and returns 1. Under
  `set -e` that aborts into the same policy. Without `set -e` the script carries on after it.
- `hook_fail_closed` on `Stop` or `SubagentStop` still fails open when `stop_hook_active` is `true`, so a
  crashing hook cannot keep blocking in a loop.
- A failure while the library loads, such as a missing `host.sh`, is a silent exit 0.
- Assign input to a variable before you use it: `cmd=$(hook_input tool_input.command)`, then `case "$cmd" in`.
  A failing `$(...)` inside a command's arguments or a `case` word does not trip `set -e`, so the script
  carries on with an empty value.

Logs live in `${XDG_STATE_HOME:-~/.local/state}/pluginfinity/<plugin>/`. `hook-error.log` holds failures and
`hook-debug.log` holds debug lines, written when `PLUGINFINITY_HOOK_DEBUG=1`, which also logs each hook's
raw input as an `input:` line and, when the hook exits, its result as one `outcome:` line: `block`, `deny`,
`allow`, `ask`, `context`, `system_message`, `noop`, `raw`, `none` (it sent no response), or `fail-closed deny` /
`fail-closed block` when the library sent the response for a crash. A non-zero exit code is appended, as in
`outcome: none (exit 3)`. A helper the host cannot honour on the event, such as `hook_deny` on `Stop`, sends `{}` and
logs `noop`: the outcome is what was sent, not what you asked for. A second response is ignored and the first
kind stays the outcome. If the library itself fails to load (no `jq`, or a missing `host.sh`), the hook exits
before any logging and writes no `outcome:` line. Use it to see what a host sends and what your hook answered.
`hook_log` and `hook_debug` append to the logs from your own script.

With `PLUGINFINITY_HOOK_DEBUG=1`, prompts and tool inputs are written to a plaintext log. Do not leave it set
outside a debugging session.

## Testing hooks

pluginfinity ships a bats helper that runs a plugin's built hook scripts the way each host runs them. Put
tests in `plugins/<name>/__test__/*.bats` and hand-written inputs in `__test__/fixtures/*.json`. Load the
helper at the top of each file:

```bash
load "$BATS_TEST_DIRNAME/../node_modules/pluginfinity/bats/pluginfinity.bash"
```

| Helper | Does |
| :-- | :-- |
| `run_hook <target> <script> <fixture> [VAR=value...]` | Runs `builds/<target>/<script>` under `env -i` with that host's environment, the fixture on stdin and any extra variables. Sets bats `$status`, `$output` and `$stderr`. A relative fixture is read from `__test__/fixtures/` |
| `assert_hook_exit <n>` | The exit code is `n` |
| `assert_hook_json <jq-filter> <expected>` | The filter's raw value over stdout equals `expected` |
| `assert_hook_noop` | Exit 0 with no output or `{}` |
| `hook_fixture <event> [overrides-json]` | Writes a Claude-shaped input for the event to a temp file and prints its path |

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

`run_hook` on the claude target sets `CLAUDE_PROJECT_DIR` from `HOOK_PROJECT_DIR`, which defaults to the test's
temp directory (`$BATS_TEST_TMPDIR`). Set it in front of the call to point `hook_project_dir` at a fixture project:
`HOOK_PROJECT_DIR="$BATS_TEST_TMPDIR/proj" run_hook claude hooks/stop.sh stop.json`.

Tests run against `builds/`, not the source, so run `pluginfinity build` first. Run them with
`bats --recursive __test__`.

A hand-written fixture must set `hook_event_name`, as Claude Code's input does. `run_hook` reads it on
both targets: the claude run takes it from the input, and the copilot run gets it as
`PLUGINFINITY_EVENT`, as the build sets on every Copilot entry. Without it the hook has no event, so
`hook_context` and every other event-dependent call answers `{}`, and a test that expects a no-op can
pass for the wrong reason. `hook_fixture` sets it for you.

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

pluginfinity also writes the hook library into every build with hooks, as `hooks/lib/pluginfinity/*.sh`
plus a generated `host.sh`. That path is reserved: a source file under `hooks/lib/pluginfinity/` fails
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
