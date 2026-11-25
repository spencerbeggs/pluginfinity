# The bash hook library

This is the reference for `hook.sh`, the library a bash hook sources: reading the event, answering, session env,
what the library does when a script fails, and the build's scan for output a host ignores. The entry in the
config, how it is written for each host and what ships are in the `pluginfinity` skill's
[hooks](${CLAUDE_PLUGIN_ROOT}/skills/pluginfinity/references/hooks.md) reference; which answers each host honours on
each event is the `hook-events` skill. Test a hook with [the bats helper](testing.md).

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

## Reading the event

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

## Responding

Call one of these to answer the host. What each does depends on the host:

| Function | Claude | Copilot |
| --- | --- | --- |
| `hook_context "t"` | `hookSpecificOutput{hookEventName, additionalContext}` on SessionStart, SubagentStart, PostModelSwitch, UserPromptSubmit, UserPromptExpansion, PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch, Stop, SubagentStop; no-op (`{}`) elsewhere | flat `additionalContext` on SessionStart, SubagentStart, PostToolUse, Notification; no-op elsewhere (including UserPromptSubmit) |
| `hook_deny "r"` | `hookSpecificOutput{hookEventName, permissionDecision: deny, permissionDecisionReason}` on PreToolUse, PreModelSwitch and PreSkillShellCommand | flat `permissionDecision: deny` + `permissionDecisionReason` |
| `hook_allow [reason] [json]` | `hookSpecificOutput{hookEventName, permissionDecision: allow}` (+ `permissionDecisionReason`, and `updatedInput` on PreToolUse only) on PreToolUse and PreModelSwitch | `allow` (+ `permissionDecisionReason`, `modifiedArgs`) |
| `hook_ask "r"` | `hookSpecificOutput{hookEventName, permissionDecision: ask}` on PreToolUse and PreModelSwitch | `ask` (the cloud agent treats it as deny; documented) |
| `hook_block "r"` | top-level `decision: block` + `reason` on UserPromptSubmit, UserPromptExpansion, PreSkillShellCommand, PostToolUse, PostToolBatch, Stop, SubagentStop, ConfigChange, PreCompact, TaskCreated, TaskCompleted, TeammateIdle, PreModelSwitch, Elicitation, ElicitationResult; no-op elsewhere | `decision: block` + `reason` on Stop, SubagentStop; no-op elsewhere |
| `hook_system_message "t"` | `systemMessage`, shown to the user and not added to model context; no-op on the events that discard it or hand it elsewhere: Setup, InstructionsLoaded, MessageDisplay, Notification, StopFailure, ConfigChange, DirectoryAdded, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, SessionEnd, Elicitation and ElicitationResult | no-op |
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
  `PLUGINFINITY_DEBUG=1`. `hook_deny`, `hook_allow` and `hook_ask` work on `PreToolUse` on both hosts; on Claude Code all three also
  answer `PreModelSwitch`, and `hook_deny` answers `PreSkillShellCommand`.
- `hook_rewake "<message>"` wakes the agent from a background hook: it ends the script with exit code 2 and the
  message on stderr. It works only on an entry that sets `asyncRewake: true`; on any other entry it logs and returns
  0, since that exit code would block the action instead. Call it at the top level, not in a subshell.
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

## Session env

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
[session env](${CLAUDE_PLUGIN_ROOT}/skills/pluginfinity/references/session-env.md).

## When a script fails

The library installs an `EXIT` trap. If the script exits non-zero, aborts under `set -e` or finds no `jq`, the
trap records the failure in the error log and exits 0, so the hook fails open. That matters on Copilot,
where a failing `preToolUse` hook denies the tool call.

- `hook_fail_closed`, or `failClosed: true` on the entry, makes the trap respond with a deny (`PreToolUse`)
  or a block (where the host honours one) instead. The entry form takes effect even when the script dies
  before it reaches a call, so prefer it for a guard. The call does nothing if the script already sent a
  response.
- `failClosed: true` on the entry also writes Claude Code's `onFailure: "block"` (Claude Code 2.1.295 or
  later), so a hook the host cannot start, that times out or that prints output it cannot read stops the
  action too. The library cannot cover those from inside the script. `hook_fail_closed` in the script does
  not add it.
- A closed guard never blocks on `TaskCompleted` or `TeammateIdle`, and never on `Stop` or `SubagentStop`
  once `stop_hook_active` is true: a block there sends the agent back to work on a hook it cannot repair.
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

`hook_log` writes a line to `error.log` and `hook_debug` one to `debug.log`; the files, the line format, the
`PLUGINFINITY_DEBUG=1` switch and `pluginfinity logs` are in the `pluginfinity` skill's
[logging](${CLAUDE_PLUGIN_ROOT}/skills/pluginfinity/references/logging.md) reference. With the switch set, a hook also logs its raw input as an `input:` line and, when it exits, its result as one `outcome:` line: `block`, `deny`,
`allow`, `ask`, `context`, `system_message`, `noop`, `raw`, `none` (it sent no response), or `fail-closed deny` /
`fail-closed block` when the library sent the response for a crash. A non-zero exit code is appended, as in
`outcome: none (exit 3)`. A helper the host cannot honour on the event, such as `hook_deny` on `Stop`, sends `{}` and
logs `noop`: the outcome is what was sent, not what you asked for. A second response is ignored and the first
kind stays the outcome. If the library itself fails to load (no `jq`, or a missing `host.sh`), the hook exits 0, writes one `error.log` line (`host.sh not loadable; hook skipped` or `jq not found; hook skipped`) and writes no `outcome:` line. Use it to see what a host sends and what your hook answered.

## Output a host ignores

Where a host discards a helper's output on an event, such as `hook_context` on a Copilot event it does not
read, the build lists a `hook-output-ignored` note naming the script and `<Event>:<helper>`. The scan is best
effort: it strips comments, reads whole-word helper names, does not model heredocs, cannot see a call made
through a variable or a sourced file, and skips events only Copilot has.
