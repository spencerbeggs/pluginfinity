---
"@pluginfinity/core": minor
"@pluginfinity/targets": minor
"@pluginfinity/engine": minor
"@pluginfinity/cli": minor
"pluginfinity": minor
---

## Features

### Native hooks

A hook entry can now run a prebuilt native program instead of a bash script:

```ts
hooks: {
  PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/guard", timeout: 5, failClosed: true }],
}
```

`binary` is a path prefix. The build ships every `<binary>-<os>-<arch>` file beside it, named for what `uname -s` and `uname -m` print (`guard-Darwin-arm64`, `guard-Linux-x86_64`, `guard-Windows-x86_64.exe`), and writes each host a command that runs the one for the machine. A prefix with no platform file, or a platform file without its executable bit, fails the build. Each target with a binary hook also gets `lib/pluginfinity/facts.json`, holding the host's tool names, the components the build ships and the declared session variables.

The repository is now also a Zig package, `pluginfinity_hooks`, for writing those programs. It reads either host's input, answers in either host's shape, and matches the bash hook library on fail policy, logging, run-time matchers and session env. `addHooks` in a plugin's `build.zig` builds every hook for macOS, Linux and Windows at about 200 KB each.

### More hook handlers and entry fields

* `http`, `mcpTool`, `prompt` and `agent` entries, written as Claude Code's `http`, `mcp_tool`, `prompt` and `agent` handlers. An `mcpTool` that names one of the plugin's own servers is given the plugin's scope.
* `if`, `statusMessage`, `async` and `asyncRewake` on an entry, and `shell` on a `command` entry.
* `hook_rewake "<message>"` in the hook library wakes the agent from an `asyncRewake` hook.
* The plugin's `description` is written at the top of Claude Code's hooks file.
* Copilot runs command hooks only: another handler fails its build unless the entry sets `fallback: "omit"`, and a field its hooks file has no place for is left out with a `hook-field-dropped` note.
* The build rejects an `if` on an event that never evaluates it, a handler an event does not run, and `failClosed` on a background, `prompt` or `agent` hook.

### Hook event schemas

`@pluginfinity/core` exports `HOOK_IO`, the input and output schema of every Claude Code hook event, and `TOOL_INPUTS`, the `tool_input` of each built-in tool. `hookSchemaFiles()` renders them as JSON Schema documents and `hookEventsZig()` as Zig types.

### Hook library

* `PreSkillShellCommand` is a valid event.
* `hook_deny`, `hook_allow` and `hook_ask` answer `PreModelSwitch` on Claude Code, and `hook_deny` answers `PreSkillShellCommand`.
* `hook_block` is honoured on `TaskCompleted`, `TeammateIdle`, `PreSkillShellCommand`, `Elicitation` and `ElicitationResult`.
* A `failClosed` entry is also written with Claude Code's `onFailure: "block"`, so a hook that cannot start, times out or prints unreadable output stops the action too.

## Bug Fixes

* `hook_system_message` no longer sends a message on the ten events where Claude Code discards it, such as `Setup`, `StopFailure` and `PostCompact`. It answers with a no-op there, and the build notes a script that relies on it.
* A matcher written as a comma list, such as `startup, resume`, is now read as Claude Code reads it where the library applies matchers, and is widened for Copilot's `new` session source.
* A crashing `failClosed` hook no longer blocks on `TaskCompleted` or `TeammateIdle`, where a block would keep a teammate working on a hook it cannot repair.
