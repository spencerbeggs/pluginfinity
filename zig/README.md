# pluginfinity-hooks (Zig)

Write agent-plugin hooks as small native programs instead of bash scripts.

A hook built with this library is one self-contained binary per platform, about 200 KB, with no runtime dependency: no `jq`, no Node, no bash library. One source file serves both Claude Code and GitHub Copilot. It lives in the pluginfinity repository, whose root `build.zig.zon` makes that repository a Zig package holding only this library. `pluginfinity build` ships the binaries and writes each host's hooks file from a `binary` hook entry.

This is an experiment. The API will change.

## Requirements

- Zig 0.17.1. The library follows Zig's standard library closely, so match the version.
- pluginfinity with `binary` hook entries.

## Add it to a plugin

In the plugin root:

```sh
zig init --minimal
zig fetch --save git+https://github.com/spencerbeggs/pluginfinity
```

`build.zig`:

```zig
const std = @import("std");
const hooks = @import("pluginfinity_hooks");

pub fn build(b: *std.Build) void {
    hooks.addHooks(b, .{ .names = &.{"guard"} });
}
```

`native/guard.zig`:

```zig
const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

fn handle(h: *hook.Hook) !void {
    const cmd = h.input("tool_input.command") orelse return h.noop();
    if (std.mem.indexOf(u8, cmd, "git push --force") != null) {
        return h.deny("force pushes are not allowed in this project");
    }
    h.noop();
}
```

`pluginfinity.config.ts`:

```ts
hooks: {
  PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/guard", failClosed: true }],
},
```

Then:

```sh
zig build test        # the hooks' unit tests
zig build -p hooks    # hooks/bin/guard-<os>-<arch>, for every platform
pluginfinity build
```

Keep hook sources out of `hooks/`: pluginfinity ships every file under it. `native/` is the default, and `source_dir` changes it.

## Platforms

`addHooks` builds each hook for macOS arm64, macOS x86_64, Linux x86_64, Linux arm64 and Windows x86_64. The Linux binaries are static. Each file is named `<hook>-<os>-<arch>` after what `uname -s` and `uname -m` print there, which is how the built hook entry finds the one for the machine. A machine with no binary runs nothing and the hook fails open, unless the entry sets `failClosed: true`: then the entry exits 1, which Claude Code blocks on and Copilot reads as a deny on `preToolUse`.

## The library

`hook.run(init, handler)` is the whole life of a hook process. It reads the event from stdin, calls the handler, writes at most one JSON response and always exits 0.

| Call | What it does |
| --- | --- |
| `h.input("tool_input.command")` | A field by its Claude Code name, dotted for nested keys. Falls back to Copilot's spelling. Null when missing. |
| `h.noop()` | Let the action proceed. |
| `h.deny(reason)`, `h.allow(reason)`, `h.ask(reason)` | A PreToolUse permission decision. On Claude Code, also a model switch (PreModelSwitch), and `deny` before a skill's injected shell command (PreSkillShellCommand). |
| `h.allowWith(reason, value)` | Allow a tool call with its input replaced by `value`, any value that serializes to a JSON object. |
| `h.context(text)` | Add text to the model's context. |
| `h.block(reason)` | Block the event's action. |
| `h.systemMessage(text)` | Show the user a message (Claude Code only). |
| `h.raw(.claude, value)` | Send a response only that host understands, as it is. Nothing happens on the other host. |
| `h.log(fmt, args)`, `h.debug(fmt, args)` | Append to the plugin's `error.log`, and to `debug.log` when `PLUGINFINITY_DEBUG=1`. Read them with `pluginfinity logs`. |
| `h.as(hook.events.PreToolUse)`, `h.toolInput(hook.events.tools.Bash)` | The event, or the tool's arguments, as a generated type. Works on both hosts. |
| `h.projectDir()`, `h.sessionDir()`, `h.cdProject()` | Where this call runs, the session's project, and a change into the first. |
| `h.toolName("Read")`, `h.toolPrefix(server)`, `h.has(.skill, name)` | The host's run-time tool names and what this build ships, from the facts file the build writes. |
| `h.env(name)`, `h.envSet(name, value)` | A session variable the plugin's config declares, resolved as the bash library resolves it and kept in the same files. |
| `h.relay(json)`, `h.envelope()` | Answer with a Claude-shaped response through the helper that fits; the input in Claude Code's shape. |
| `h.rewake(message)` | Wake the agent from a background hook, on an entry that sets `asyncRewake`. |
| `h.can(.block)` | Whether this host honours a capability on this event. |
| `h.host`, `h.event`, `h.plugin` | Where the hook is running. |

A response the host does not honour on the event becomes a no-op. Only the first response counts.

A handler that returns an error fails open: no output, exit 0. On an entry with `failClosed: true` it denies or blocks instead, except where the agent could not recover (TaskCompleted, TeammateIdle, and a stop hook that is already continuing). pluginfinity also writes Claude Code's `onFailure: "block"` for such an entry, so a hook that crashes, times out or cannot start stops the action too.

A panic gets the same treatment, and a line in the error log: the build installs the library's panic handler in every hook, so the `pub const panic = hook.panic;` line in a hook's own file is harmless and no longer needed.

`addHooks` builds each binary in two modes at once. Its root is a small entry shim compiled for size, which is the mode Zig then uses for the standard library, and the standard library is most of a hook. The hook's own source and this library are compiled with `ReleaseSafe`, so a bug in either, such as an out-of-bounds index, still panics. That gives a binary the size of an unchecked build (about 215 KB against 355 KB with everything checked) that still catches the bug. Checks inside the standard library itself are off. `optimize = .ReleaseSmall` turns them off in the hook and the library too, saves almost nothing, and lets a closed guard pass a call through on such a bug.

Copilot ignores the matcher on `SessionStart`, `SessionEnd` and `SubagentStop`, so the build passes it to the hook and the library applies it: a hook whose matcher does not match ends quietly. An exact list such as `startup|resume` always works. A regular expression such as `^start` needs the opt-in engine:

```zig
hooks.addHooks(b, .{ .names = &.{"guard"}, .regex = true });
```

That links [regex.zig](https://github.com/muhammad-fiaz/regex.zig), pinned by hash in this package's manifest, at about 165 KB per binary. It is linear-time and has no lookaround or backreferences; a pattern that uses one is refused by name, and the hook runs. Without the option a regular-expression matcher is not applied: the hook runs for every value and says so in the error log.

The build passes the facts a hook needs as environment variables: `PLUGINFINITY_HOST`, `PLUGINFINITY_EVENT`, `PLUGINFINITY_PLUGIN`, `PLUGINFINITY_FAIL_CLOSED` and `PLUGINFINITY_MATCHER`.

## Not here yet

The library now covers what the bash hook library does. Two things remain: the env setup script runs only in the SessionStart runner, which is a bash script on both libraries, and a Windows binary is built (`<hook>-Windows-x86_64.exe`, found under Git Bash) but has not been run on Windows.

## Testing a hook

`hook.testing.respond` runs a whole handler against an input and returns what it would answer:

```zig
test "a force push is denied" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const answer = try hook.testing.respond(arena.allocator(), handle, .{
        .event = "PreToolUse",
        .input = "{\"tool_input\":{\"command\":\"git push --force\"}}",
    });
    try std.testing.expect(std.mem.indexOf(u8, answer.?, "\"deny\"") != null);
}
```

Set `.host = .copilot`, `.fail_closed = true` or `.facts = "<json>"` to test the other paths.

## Ignore Zig's directories

Add `.zig-cache/`, `zig-out/` and `zig-pkg/` to the plugin's `.gitignore`. Only `hooks/bin/` ships.

## Example

`zig/examples/guard` is a complete plugin.

## Working on the library

From the repository root, `zig build test` runs the library's unit tests, and `zig build -Ddev test` also tests the regex matcher (the first run fetches the engine). The repository's own test suite also builds `zig/test/responder.zig` and checks every response on every event against the hook event schemas, when `zig` is on `PATH`.

## License

MIT
