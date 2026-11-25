# Hooks

Hooks are declared once, in the config's `hooks`, keyed by Claude Code event name. Each event holds a
list of entries; each entry is a script, a command, a prebuilt binary or, on Claude Code, one of four handlers
that run no program of yours.

This page is the config: what an entry may hold, how the build writes it for each host, what happens when
a hook fails, and what ships. It is the same for a bash hook and a native one.

| For | Read |
| :-- | :-- |
| Which event to use, and what it receives and may answer on each host | the `hook-events` skill |
| Writing a bash hook | the `bash-hooks` skill, with [the bash hook library](${CLAUDE_PLUGIN_ROOT}/skills/bash-hooks/references/library.md) and [testing hooks with bats](${CLAUDE_PLUGIN_ROOT}/skills/bash-hooks/references/testing.md) |
| Writing a native hook | the `native-hooks` skill, with [its API](${CLAUDE_PLUGIN_ROOT}/skills/native-hooks/references/api.md) |

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
| `binary` | A path prefix from the plugin root, such as `hooks/bin/guard`, for a prebuilt native program. The build ships every `<prefix>-<os>-<arch>` file beside it and each machine runs its own; `args` works as on a `script` |
| `matcher` | Which tools or sources the hook applies to, in Claude Code's terms. Where a host ignores it, the library applies it at run time; see [matchers a host ignores](#matchers-a-host-ignores) |
| `timeout` | Seconds, a positive whole number |
| `fallback` | What a host without the event does: `"fail"`, the default, or `"omit"` |
| `failClosed` | Deny or block when the script fails before answering. Defaults to failing open; see [when a hook fails](#when-a-hook-fails) |
| `if` | A Claude Code permission rule, such as `Bash(git *)` or `Edit(*.ts)`: the hook runs only for a matching tool call, and no process starts otherwise. Only on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied` and `PreSkillShellCommand`; anywhere else the build fails, because Claude Code would never run the hook |
| `statusMessage` | The spinner text shown while the hook runs |
| `async` | `script`, `command` and `binary` only. Runs in the background; the hook can then decide nothing, and what it prints reaches the agent on the next turn |
| `asyncRewake` | `script`, `command` and `binary` only. Runs in the background and may wake the agent: a script calls `hook_rewake "<message>"` |
| `shell` | `command` only: `"bash"` or `"powershell"` |

An entry has exactly one handler: `script`, `command`, `binary`, `http`, `mcpTool`, `prompt` or `agent`. A `binary` entry runs a prebuilt native program, one file per platform; the `native-hooks` skill covers it.

### Handlers only Claude Code runs

| Entry | What it does |
| :-- | :-- |
| `{ http: "<url>", headers?, allowedEnvVars? }` | POSTs the event's JSON to the URL and reads the response body as the answer. A header value may name an environment variable listed in `allowedEnvVars` |
| `{ mcpTool: { server, tool, input? } }` | Calls a tool on an MCP server and reads its text as the answer. Name one of the plugin's own servers by its key in `mcpServers`; the build writes the scoped `plugin:<plugin>:<server>`. A string in `input` may take a field of the event, as `"${tool_input.file_path}"` |
| `{ prompt: "<text>", model?, continueOnBlock? }` | Asks a model one question; `$ARGUMENTS` is the event's JSON |
| `{ agent: "<text>", model? }` | Runs a subagent with tool access to verify a condition. Experimental on Claude Code |

- Copilot runs `script`, `command` and `binary` hooks only. Another handler fails the Copilot build unless the entry sets `fallback: "omit"`, which leaves it out there with a `hook-omitted` note named `<Event> (<handler>)`.
- Claude Code runs `prompt` and `agent` hooks only on `PermissionDenied`, `PostToolBatch`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `TaskCompleted`, `TaskCreated`, `TeammateIdle`, `UserPromptExpansion` and `UserPromptSubmit`, plus `prompt` on `PermissionRequest`. `SessionStart` runs only `script`, `command`, `binary` and `mcpTool`; `Setup` only the first three. The build fails on any other pairing.
- `failClosed` works on `http` and `mcpTool` as it does on a script, through Claude Code's `onFailure`. It is a build error on a `prompt` or `agent` hook and on a background hook, where nothing reads it.
- `if`, `statusMessage`, `async`, `asyncRewake` and `shell` have no place in Copilot's hooks file. The build leaves them out there with a `hook-field-dropped` note named `<Event> <field>`, so on Copilot a hook with an `if` runs on every matcher hit and an `async` hook runs in the foreground.
- The plugin's `description` is written at the top of Claude Code's hooks file.

## How an entry runs

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

A `binary` entry is written as one `sh -c` line that is the same for every binary. It takes the path prefix
and the plugin root, runs `<prefix>-<os>-<arch>` for the machine, named for what `uname -s` and `uname -m`
print there (`Windows` and `.exe` under Git Bash), and hands it the plugin root as `PLUGINFINITY_ROOT`. A machine
with no file for it runs nothing and exits 0, or exits 1 on a `failClosed` entry. `scripts.invoke` does not apply.

Every hook entry carries its facts as environment variables, so a hook needs no host branch to learn
them: `PLUGINFINITY_EVENT` (the event, in Claude Code's spelling), `PLUGINFINITY_HOST` and `PLUGINFINITY_PLUGIN`,
`PLUGINFINITY_FAIL_CLOSED=1` when the entry sets `failClosed`, `PLUGINFINITY_ASYNC_REWAKE=1` when it sets
`asyncRewake`, and `PLUGINFINITY_MATCHER` when the host ignores the entry's matcher. A `command`
entry that does not source the library still gets them, but nothing reads them; see
[matchers a host ignores](#matchers-a-host-ignores).

The plugin root is `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Copilot. Copilot also
sets `CLAUDE_PLUGIN_ROOT` in a hook's environment, so a script can read either.

## When a hook fails

A hook fails open: a hook that crashes, cannot read its input or is missing a tool it needs lets the action
proceed and writes a line to the plugin's `error.log`. Both hook libraries turn a crash into a clean exit, which
matters on Copilot, where a non-zero exit from a `preToolUse` hook denies the tool call.

- `failClosed: true` on the entry makes the library answer a crash with a deny (`PreToolUse`) or a block (where
  the host honours one) instead. It takes effect even when the hook dies before its first line of your code runs.
- `failClosed: true` also writes Claude Code's `onFailure: "block"` (Claude Code 2.1.295 or later), so a hook
  the host cannot start, that times out or that prints output it cannot read stops the action too. No library
  can cover those from inside the hook.
- A `binary` entry on a machine with no platform file for it fails open like any other hook: it exits 0 and
  says nothing. With `failClosed: true` it exits 1, which Claude Code blocks on and Copilot reads as a deny on
  `preToolUse`, so build every platform your users run before you close a native guard.
- A closed guard never blocks on `TaskCompleted` or `TeammateIdle`, and never on `Stop` or `SubagentStop`
  once `stop_hook_active` is true: a block there sends the agent back to work on a hook it cannot repair.
- **Fail closed only for a guard that must not let a call through when it breaks**, such as a hook that
  denies a destructive command or protects a path. Leave a hook that adds context, reacts to an edit or
  gates a Stop open: a crash there should cost one missing message, not a blocked session. On Copilot a
  closed guard on an event that can neither deny nor block still fails open.
- `failClosed` works on `http` and `mcpTool` through `onFailure` alone. It is a build error on a `prompt` or
  `agent` hook and on a background hook, where nothing reads it.

Every hook logs to the plugin's `error.log` and, with `PLUGINFINITY_DEBUG=1`, its `debug.log`. Read them with
`pluginfinity logs`; see [logging](logging.md).

## Matchers a host ignores

Claude Code applies an entry's `matcher`. Copilot ignores it on `SessionStart`, `SessionEnd` and
`SubagentStop`. For those events on Copilot the build hands the matcher to the script as
`PLUGINFINITY_MATCHER` and lists a `hook-matcher-runtime` note under `config`. The library then applies it
with Claude Code's rules, against `source`, `reason` and `agent_type` respectively: empty or `*` matches all, a value of only letters,
digits, `_`, `|`, spaces, `,` and `-` is an exact list split on `|` or `,` (spaces around an item are ignored), and anything else is an unanchored extended
regular expression. A hook that does not match ends quietly with exit 0 and no response.

This holds **only for an entry whose hook is written on a library**: a `script` that sources `hook.sh`, or a
`binary` built on the native library. A plain `command` entry on such an event gets the variable and the note,
but nothing reads it, so on Copilot the hook runs for every source. The native library applies an exact list
always and a regular expression only when the hooks were built with regex support, which the build cannot see,
so a `binary` entry with a regular-expression matcher also gets a `hook-matcher-native-regex` note.

Copilot reports a fresh session's `source` as `new`, where Claude Code says `startup` (Copilot CLI 1.0.92,
measured 2026-10-07). So on Copilot the build widens a `SessionStart` matcher list that holds `startup`: it
inserts `new` after it, `startup` becomes `startup|new` and `startup|resume` becomes `startup|new|resume`, and
lists a `hook-matcher-widened` note. Write `startup` as on Claude Code; never add `new` for Copilot yourself.
An empty or `*` matcher, a list that already holds `new` and a matcher without `startup` stay as written. A
regex that matches `startup` but not `new`, such as `^start`, is left alone with a `hook-matcher-regex` note:
widen it by hand, or write it as a list.

## What ships

Every host gets the source `hooks/` directory whole, so a script can source helpers the config never
names, except scripts only another host's hooks run. Keep test data out of `hooks/`. A script outside
`hooks/` ships to the hosts that run it, as does any file a `command` names as `${PLUGIN_ROOT}/<path>`;
the build fails if one is missing. Clutter such as `.DS_Store` never ships.

A `binary` entry ships every platform file beside its prefix: `hooks/bin/guard` ships `hooks/bin/guard-Darwin-arm64`,
`hooks/bin/guard-Linux-x86_64`, `hooks/bin/guard-Windows-x86_64.exe` and so on. The build does not compile them and
cannot tell a stale one from a fresh one, so rebuild them before `pluginfinity build`. A prefix with no platform
file, or a platform file without its executable bit, fails the build. Keep the sources out of `hooks/`, which
ships whole.

pluginfinity also writes the bash hook library into every build with hooks, as `hooks/lib/pluginfinity/hook.sh`
plus a generated `host.sh` and `tools.sh` (the host's run-time tool names, read by `hook_tool_name`). The
log library goes to `lib/pluginfinity/log.sh`, and a config that declares `env` adds `lib/pluginfinity/env.sh`,
the runner `lib/pluginfinity/env-run.sh`, and ships the `env.setup` script. A build with a `binary` hook also
gets `lib/pluginfinity/facts.json`, which tells a native hook what `tools.sh` and `host.sh` tell a script: the
host's tool names, the skills, agents, monitors and servers this build ships, and the declared session env. The library paths are reserved: a source file under `hooks/lib/pluginfinity/` fails
the build, and `build --check` reports a library from a different pluginfinity version as drift.

pluginfinity writes the hooks file itself: `hooks/hooks.json` on Claude Code and
`com.github.copilot/hooks/hooks.json` on Copilot. A source file at either path fails the build.

## Events a host lacks

Which events each host runs, what each receives and what it may answer are in the `hook-events` skill. Two
things about them are config:

- An event a host lacks fails the build unless every entry for it sets `fallback: "omit"`, which skips it there
  and lists it as a `hook-omitted` note under that host's line in the build output.
- To give one host a different hook for an event, override that event under the host's key in the config:
  `copilot: { hooks: { SessionStart: [...] } }`. `[]` removes the event there.
