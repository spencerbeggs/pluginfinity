---
name: native-hooks
description: >-
  Use when writing a hook as a compiled native program instead of a bash script in a pluginfinity
  plugin: a `binary` hook entry in pluginfinity.config.ts, a Zig hook source under native/, the plugin's
  build.zig or build.zig.zon, or the prebuilt files under hooks/bin/. Walks the setup, the write-test-build
  loop and the rules a native hook must keep, with references for the library's API, the Zig 0.17 that
  differs from older Zig, and tested recipes. Experimental.
paths:
  - "**/native/**/*.zig"
  - "**/build.zig"
  - "**/build.zig.zon"
  - "**/hooks/bin/**"
---

# Writing a native hook

A `binary` hook entry runs a prebuilt native program instead of a bash script. The program needs nothing on the user's machine: no `jq`, no bash library, no runtime. pluginfinity does not compile it. You build one file per platform with Zig, and `pluginfinity build` ships them and writes each host's hooks file.

This is experimental. A bash `script` entry, covered by the `hook-authoring` skill, is still the default.

Three references hold the detail. Load one when you need it, not all at once:

- [API](references/api.md): every call on the hook, what it returns and when it fails.
- [Zig 0.17](references/zig.md): **read this before writing any Zig.** The standard library changed a great deal by 0.17, and Zig written from memory of an older release does not compile.
- [Recipes](references/recipes.md): five complete, tested hooks to copy.

## When to choose it

- Choose a native hook when the hook runs often and its start-up time shows (about 2 ms, against tens of milliseconds for bash and `jq`), when the logic is awkward in bash, when it should be unit-tested without bats, or when the user's machine may lack `jq`.
- Stay with a script for a hook that is two lines of bash, or in a repository where nobody will install Zig.

## Set up once per plugin

Zig **0.17.1** is required; check with `zig version`. In the plugin root:

```sh
zig init --minimal
zig fetch --save git+https://github.com/spencerbeggs/pluginfinity
```

`zig init --minimal` writes `build.zig` and `build.zig.zon`. `zig fetch --save` adds the library to `build.zig.zon` under the name `pluginfinity_hooks`, pinned by hash. Then replace the whole of `build.zig` with:

```zig
const std = @import("std");
const hooks = @import("pluginfinity_hooks");

pub fn build(b: *std.Build) void {
    hooks.addHooks(b, .{ .names = &.{"guard"} });
}
```

Each name in `names` is a program at `native/<name>.zig`. Add to `.gitignore`:

```text
.zig-cache/
zig-out/
zig-pkg/
```

`addHooks` options, all optional but `names`:

| Option | Default | Meaning |
| :-- | :-- | :-- |
| `names` | required | One hook per name, each at `<source_dir>/<name>.zig`. A name may hold hyphens |
| `source_dir` | `"native"` | Where the sources live. Never `hooks`: pluginfinity ships every file under `hooks/` |
| `regex` | `false` | Link the regex engine so a regular-expression matcher works where the library applies matchers (see the rules). About 165 KB per binary |
| `optimize` | `.ReleaseSafe` | Leave it. The build already compiles the standard library for size, so a binary is about 200 KB; this option covers only the hook's own source and the library, where `.ReleaseSmall` saves almost nothing and drops the safety checks, so a bug no longer panics and a `failClosed` guard can let a call through |

## Write the hook

`native/guard.zig`, complete:

```zig
const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

fn isForcePush(command: []const u8) bool {
    return std.mem.indexOf(u8, command, "git push --force") != null;
}

fn handle(h: *hook.Hook) !void {
    const command = h.input("tool_input.command") orelse return h.noop();
    if (isForcePush(command)) return h.deny("force pushes are not allowed in this project");
    h.noop();
}

test "a force push is caught" {
    try std.testing.expect(isForcePush("git push --force origin main"));
    try std.testing.expect(!isForcePush("git push origin main"));
}

test "the handler denies a force push" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const answer = try hook.testing.respond(arena.allocator(), handle, .{
        .event = "PreToolUse",
        .input = "{\"tool_input\":{\"command\":\"git push --force\"}}",
    });
    try std.testing.expect(std.mem.indexOf(u8, answer.?, "\"permissionDecision\":\"deny\"") != null);
}
```

The first three declarations are the same in every hook. Everything else is the handler and its tests.

Then the entry in `pluginfinity.config.ts`:

```ts
hooks: {
  PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/guard", timeout: 5, failClosed: true }],
},
```

`binary` is a path prefix, not a file: the build ships every `hooks/bin/guard-<os>-<arch>` beside it.

A plugin with nothing else is this config and a `package.json` beside it holding a `"version"` string, which every manifest copies. The `pluginfinity` skill covers the rest of the config.

```ts
import { defineConfig } from "pluginfinity";

export default defineConfig({
  name: "my-plugin",
  description: "What the plugin does",
  hooks: {
    PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/guard", timeout: 5, failClosed: true }],
  },
  claude: true,
  copilot: true,
});
```

## The loop

1. Write the hook and its tests in `native/<name>.zig`, and add the name to `addHooks`.
2. `zig build test` runs every hook's tests on this machine. Fix what it reports before going on.
3. `zig build -p hooks` writes `hooks/bin/<name>-<os>-<arch>` for all five platforms. The first run takes a minute.
4. Add the `binary` entry to `pluginfinity.config.ts`.
5. `pluginfinity build`, then `pluginfinity build --check`.
6. Run the built hook by hand to see its real answer:

```sh
echo '{"hook_event_name":"PreToolUse","tool_input":{"command":"git push --force"}}' |
  PLUGINFINITY_HOST=claude PLUGINFINITY_PLUGIN=my-plugin ./hooks/bin/guard-"$(uname -s)-$(uname -m)"
```

Set `PLUGINFINITY_HOST=copilot` and `PLUGINFINITY_EVENT=<Event>` to see Copilot's answer, and `PLUGINFINITY_FAIL_CLOSED=1` to see the closed one.

Run step 3 again before every `pluginfinity build` after a source change. pluginfinity copies whatever is in `hooks/bin/` and cannot tell a stale binary from a fresh one.

## Rules

- **Start every hook with the three declarations above.** `hook.run` reads the event from stdin, calls the handler, writes at most one response and always exits 0. `pub const panic = hook.panic;` makes a panic follow the entry's fail policy and reach the error log.
- **Never read stdin or write stdout yourself.** Only the response may reach stdout. Run a CLI with `h.exec`, which captures what it prints.
- **Allocate from `h.arena` and never free.** The process exits when the handler returns.
- **Send one response.** Only the first counts. `h.noop()` lets the action proceed; a helper the host does not honour on the event becomes a no-op too.
- **Return an error to fail.** Any error will do, and it needs no declaration: `orelse return error.MissingPath`. It fails open, or denies or blocks on a `failClosed` entry, and the error's name appears in the reason and the log. Use `try`; do not swallow an error a guard depends on.
- **Read input by Claude Code's names**, as `h.input("tool_input.file_path")`. The library finds Copilot's spelling; [what each host sends](references/api.md#what-each-host-sends) lists the differences. Use `h.as` and `h.toolInput` for typed access; a field they require that is missing is an error.
- **Write the `matcher` in Claude Code's tool names** (`Write|Edit`, `Bash`). Copilot applies it against the same names on `PreToolUse`, `PostToolUse` and `PermissionRequest`.
- **Branch on capability, not on host:** `h.can(.block)`, `h.toolName("Read")`, `h.has(.skill, "x")`. Never `if (h.host == .copilot)` for something those answer.
- **Log with `h.log` and `h.debug`**, never `std.debug.print`. Read the logs with `pluginfinity logs`.
- **Put the decision in a plain function** and test it; test the whole handler with `hook.testing.respond`.
- **Fail closed only for a guard** that must not let a call through when it breaks, and build every platform your users run first: on a `failClosed` entry a machine with no binary for it denies.
- **A matcher on `SessionStart`, `SessionEnd` or `SubagentStop`** is ignored by Copilot and applied by the library. A list such as `startup|resume` always works; a regular expression such as `^start` needs `.regex = true` in `addHooks`, or the hook runs for every value and says so in `error.log`.
- **Give a `SessionStart` entry that reads session env a `timeout` of 5 or more:** the first read may wait up to 3 seconds for the env runner.

## The entry

- An entry has exactly one handler: `script`, `command`, `binary`, `http`, `mcpTool`, `prompt` or `agent`. On a `binary` entry `args`, `matcher`, `timeout`, `fallback`, `failClosed`, `if`, `statusMessage`, `async` and `asyncRewake` work as they do on a `script` entry.
- The platform files are named for what `uname -s` and `uname -m` print: `guard-Darwin-arm64`, `guard-Darwin-x86_64`, `guard-Linux-x86_64`, `guard-Linux-aarch64`, and `guard-Windows-x86_64.exe`, which the entry finds under Git Bash and which has not been run on a Windows machine.
- Every platform file must have its executable bit, or the build fails. A prefix with no platform file fails the build as a missing hook.
- A machine with no file for it exits 0 with no output, so the hook fails open there; on a `failClosed` entry it exits 1, which Claude Code blocks on and Copilot reads as a deny on `preToolUse`.
- The build writes `lib/pluginfinity/facts.json` into each target and hands the program its plugin root. That is where `h.toolName`, `h.has` and `h.env` get their answers.

## When it does not build or run

| Symptom | Cause and fix |
| :-- | :-- |
| `no module named 'hook'` | The file was compiled on its own, as `zig test native/guard.zig`. Run `zig build test`, which supplies the module. A hook missing from `names` is not built or tested at all |
| `no member named ...` on `std` | Older Zig. See [Zig 0.17](references/zig.md) for the current spelling |
| `unused local constant`, `local variable is never mutated` | Zig refuses both. Delete the constant; write `const` for a variable that never changes |
| `zig fetch` cannot reach the repository | Fetch a local checkout instead: `zig fetch --save /path/to/pluginfinity` |
| `pluginfinity build` says the hook is missing | `hooks/bin/` is empty: run `zig build -p hooks` |
| The hook prints `{}` where you expected a decision | The helper is not honoured on that event for that host. Check `PLUGINFINITY_EVENT`, then the `hook-events` skill's table |
| The hook prints nothing and exits 0 | The handler returned an error, or a matcher did not match. Read `pluginfinity logs` |
| A regular-expression matcher is ignored | Build with `.regex = true`; `pluginfinity build` reports it as `hook-matcher-native-regex` |

## Shipping the binaries

A marketplace installs a plugin from a git ref, so the platform files must be in that ref. Either commit `hooks/bin/` and the `builds/` copies, or build them in CI and publish from there. Do not add `hooks/bin/` to `.gitignore` in a plugin that commits its builds.

## Where things live

```text
<plugin>/
  pluginfinity.config.ts          the binary entries
  build.zig, build.zig.zon        the Zig build and the library dependency
  native/<name>.zig               hook sources and their tests
  hooks/bin/<name>-<os>-<arch>    prebuilt, one per platform
  builds/<target>/hooks/bin/      generated copies, never edited
  builds/<target>/lib/pluginfinity/facts.json   generated, what the library reads
```
