# The hook library's API

Everything a handler calls is on `h`, the `*hook.Hook` it is given. `!void` and `!T` return an error union: call them with `try`. A helper the host does not honour on the current event answers with a no-op (`{}`) and a debug log line.

## The frame

```zig
const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

fn handle(h: *hook.Hook) !void { ... }
```

## Where the hook is running

| Field or call | Type | Meaning |
| :-- | :-- | :-- |
| `h.host` | `hook.Host` | `.claude` or `.copilot`. Print with `@tagName(h.host)` |
| `h.event` | `[]const u8` | The event's Claude Code name, such as `"PreToolUse"` |
| `h.plugin` | `[]const u8` | The plugin's name on this host |
| `h.arena` | `std.mem.Allocator` | Allocate from it; never free |
| `h.fail_closed` | `bool` | Whether the entry sets `failClosed` |
| `h.can(.block)` | `bool` | Whether this host honours a capability on this event: `.deny`, `.allow`, `.ask`, `.context`, `.block`, `.system_message` |

## Reading the event

| Call | Returns | Meaning |
| :-- | :-- | :-- |
| `h.input("tool_input.command")` | `?[]const u8` | A field by its Claude Code name, dotted for nested keys. A string as it is; anything else as JSON text (`"true"`, `"5"`). Null when missing. Falls back to Copilot's spelling |
| `try h.as(hook.events.PreToolUse)` | the struct | The whole event as a generated type. One per event, named for it. Common fields such as `session_id` are optional (`?`); the event's own are required, and a missing one is `error.MissingField` |
| `try h.toolInput(hook.events.tools.Bash)` | the struct | The tool's arguments as a generated type: `Bash`, `PowerShell`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Agent`, `AskUserQuestion`, `ExitPlanMode` |
| `try h.envelope()` | `std.json.Value` | The input in Claude Code's shape, whichever host sent it |

The fields a hook reads most often:

| Tool | `tool_input` fields |
| :-- | :-- |
| `Bash`, `PowerShell` | `command`, `description`, `timeout`, `run_in_background` |
| `Write` | `file_path`, `content` |
| `Edit` | `file_path`, `old_string`, `new_string`, `replace_all` |
| `Read` | `file_path`, `offset`, `limit` |
| `Grep`, `Glob` | `pattern`, `path` |

Every event also carries `session_id`, `cwd` and `hook_event_name`; a tool event adds `tool_name`, `tool_input` and `tool_use_id`. The field names and meanings for every event are in the `hook-events` skill, under `references/schemas/<Event>.input.schema.json` and `tool-input.<Tool>.schema.json`; the generated Zig types follow them exactly. Use `h.input` for a field that may be absent, and the typed calls when a missing field should fail the hook.

## What each host sends

Write a hook for Claude Code's input and the library reads Copilot's.

- **Event and tool names are Claude Code's on both hosts.** pluginfinity configures Copilot with the event names that select its Claude-compatible payload: snake_case keys (`tool_name`, `tool_input`, `session_id`) and Claude Code tool names (`Write`, `Edit`, `Bash`), with the `matcher` applied against those names. `SubagentStart` and `Notification` are the exception, arriving in camelCase (`toolName`, `sessionId`), which `h.input` also reads.
- **Inside `tool_input`, Copilot keeps its own key names.** `h.input`, `h.as` and `h.toolInput` read either spelling:

| Claude Code | Copilot |
| :-- | :-- |
| `file_path` | `path` |
| `content` | `file_text` |
| `old_string` | `old_str` |
| `new_string` | `new_str` |

- **Copilot sends no `hook_event_name` on a camelCase event.** The build passes the event as `PLUGINFINITY_EVENT`, so `h.event` is right on both.
- **A value you send back uses the host's names.** `h.allowWith` on Copilot takes Copilot's `tool_input` keys.

In a test, a Copilot input is therefore `{"tool_name":"Edit","tool_input":{"path":"/x","old_str":"a","new_str":"b"}}` with `.host = .copilot`.

## Responding

One response per run; the first wins.

| Call | Returns | Honoured on |
| :-- | :-- | :-- |
| `h.noop()` | `void` | Everywhere. Lets the action proceed |
| `try h.deny(reason)` | `!void` | `PreToolUse` on both hosts; on Claude Code also `PreModelSwitch` and `PreSkillShellCommand` |
| `try h.allow(reason)` | `!void` | `PreToolUse` on both hosts; `PreModelSwitch` on Claude Code. `reason` is `?[]const u8` |
| `try h.allowWith(reason, .{ .command = "ls" })` | `!void` | `PreToolUse`. Replaces the tool's whole input with any value that serializes to a JSON object. On Copilot use Copilot's key names |
| `try h.ask(reason)` | `!void` | As `allow` |
| `try h.context(text)` | `!void` | Adds text to the model's context. See the `hook-events` skill for the events on each host |
| `try h.block(reason)` | `!void` | Blocks the event's action, such as keeping the agent working on `Stop` |
| `try h.systemMessage(text)` | `!void` | Shows the user a message. Claude Code only |
| `try h.raw(.claude, value)` | `!void` | Sends `value` as it is on that host and does nothing on the other. For a field with no helper, such as `sessionTitle` or `updatedToolOutput` |
| `try h.relay(json)` | `!void` | Answers with a response written in Claude Code's shape, such as one a CLI printed, through whichever helper fits |
| `h.rewake(message)` | `void` | Wakes the agent from a background hook. Only on an entry that sets `asyncRewake: true`; elsewhere it logs and does nothing |

`h.raw` takes an anonymous struct:

```zig
try h.raw(.claude, .{ .hookSpecificOutput = .{ .hookEventName = "SessionStart", .sessionTitle = "auth work" } });
```

## The project and its files

| Call | Returns | Meaning |
| :-- | :-- | :-- |
| `h.projectDir()` | `[]const u8` | Where this call runs: the input's `cwd` walked up to `.git`. Never empty |
| `h.sessionDir()` | `[]const u8` | The session's project. Differs from `projectDir` in a git worktree |
| `try h.cdProject()` | `!void` | Changes into `projectDir`. Not needed before `h.exec`, which already runs there |
| `h.exists(path)` | `bool` | Whether a file or directory is there. Pass an absolute path |
| `h.readFile(path)` | `?[]const u8` | A file of up to 1 MiB, or null. Pass an absolute path |
| `try h.exec(&.{ "git", "status" })` | `hook.Exec` | Runs a program in `projectDir` and waits. An error only when it cannot start |
| `try h.execWith(argv, .{ .unset = &.{"GH_HOST"}, .set = &.{.{ "GH_PAGER", "cat" }} })` | `hook.Exec` | `exec` with the program's environment changed: the names in `unset` are removed from what the hook inherited, then the pairs in `set` are added. Works on every platform, with no shell |
| `try h.writeFile(path, bytes)` | `!void` | Writes a file whole, replacing it and creating the directories above it. Pass an absolute path |
| `h.dataDir()` | `?[]const u8` | Where the plugin keeps files between runs: the host's data directory, else `data` under the plugin's state directory. It may not exist yet; `writeFile` creates it |
| `h.getenv("NAME")` | `?[]const u8` | A process environment variable; null when unset or empty |

Build a path from the project, since the working directory is not the project on Copilot: `try std.fs.path.join(h.arena, &.{ h.projectDir(), "TODO.md" })`.

`hook.Exec` has `code` (`?u8`, null when ended by a signal), `stdout`, `stderr`, `ok()` (exit code 0) and `text()` (stdout without its trailing newline). A program that exits non-zero is not an error: check `ok()`. There is no shell, so no pipes or globs; run `sh -c` for those.

## What this build ships

| Call | Returns | Meaning |
| :-- | :-- | :-- |
| `h.toolName("Read")` | `?[]const u8` | The host's run-time name for a Claude Code tool, such as `view` on Copilot. Null where the host has none |
| `h.toolPrefix("db")` | `?[]const u8` | The run-time prefix of one of the plugin's own MCP servers |
| `h.has(.skill, "review")` | `bool` | Whether this host's build ships a `.skill`, `.agent`, `.monitor` or `.server` |

## Session env

For variables the plugin's config declares under `env`.

| Call | Returns | Meaning |
| :-- | :-- | :-- |
| `h.env("ACME_COLOR")` | `?[]const u8` | The value the session recorded, else the config default, the project's `.env` and `.env.local`, then the process environment. Null for a name the config does not declare |
| `h.envSet("ACME_COLOR", "red")` | `void` | Sets it for later hooks and, on Claude Code, for the model's shell. Only from `SessionStart`, `Setup`, `CwdChanged` or `FileChanged`; a refusal is a log line |

## Logging

| Call | Meaning |
| :-- | :-- |
| `h.log("could not read {s}", .{path})` | Appends to the plugin's `error.log`. Never fails |
| `h.debug("checked {d} files", .{count})` | Appends to `debug.log` when `PLUGINFINITY_DEBUG=1` |

The format string must be a literal. Read both with `pluginfinity logs` (`--debug` for the debug log).

## Testing a handler

```zig
const answer = try hook.testing.respond(arena.allocator(), handle, .{
    .event = "PreToolUse",
    .input = "{\"tool_input\":{\"command\":\"ls\"}}",
});
```

`respond` returns `?[]const u8`: the response JSON, or null when the handler sent nothing. A handler that returns an error is treated as `hook.run` treats it.

| Option | Default | Meaning |
| :-- | :-- | :-- |
| `.event` | required | The event's Claude Code name |
| `.input` | `"{}"` | The event's JSON as the host sends it |
| `.host` | `.claude` | `.copilot` to test Copilot's answer |
| `.fail_closed` | `false` | Whether the entry sets `failClosed` |
| `.plugin` | `"test-plugin"` | What `h.plugin` reads |
| `.facts` | none | The build facts as JSON, for a handler that calls `toolName`, `has` or `env` |
| `.async_rewake` | `false` | Whether the entry sets `asyncRewake` |

In a test there is no process around the handler, so `h.exec`, `h.execWith`, `h.writeFile`, `h.exists`, `h.readFile`, `h.getenv`, `h.dataDir` and logging do nothing: `exec`, `execWith` and `writeFile` return `error.NoIo`, `exists` false, the others null. Keep the logic that depends on them in a plain function that takes their results, and test that.

Facts for a test:

```zig
.facts = "{\"tools\":{\"names\":{\"Read\":\"view\"}},\"has\":{\"skills\":[\"review\"]},\"env\":{\"vars\":{\"ACME_COLOR\":\"blue\"}}}",
```
