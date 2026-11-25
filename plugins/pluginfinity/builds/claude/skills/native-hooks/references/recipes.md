# Native hook recipes

Each recipe is a real hook from the recipes plugin in the pluginfinity repository, `zig/examples/recipes/`. `zig build test` runs its tests, and a drift test keeps every block here identical to that plugin's files. Copy a recipe whole into `native/<name>.zig`, add the name to `addHooks`, then change only what its last line names.

All five share one `build.zig`:

```zig
const std = @import("std");
const hooks = @import("pluginfinity_hooks");

pub fn build(b: *std.Build) void {
    hooks.addHooks(b, .{
        .names = &.{ "command-guard", "startup-context", "post-edit", "stop-gate", "branch-guard" },
    });
}
```

## Recipe: Command guard

Refuses a Bash command before it runs. `h.toolInput` reads the command typed, so an input with no command is an error, and because the entry is `failClosed` that error denies.

```ts
hooks: {
	PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/command-guard", timeout: 5, failClosed: true }],
}
```

```zig
const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

/// The reason to refuse a command, or null to let it through.
fn refusal(command: []const u8) ?[]const u8 {
    if (std.mem.indexOf(u8, command, "git push") != null) {
        if (std.mem.indexOf(u8, command, "--force") != null) return "force pushes are not allowed in this project";
    }
    if (std.mem.startsWith(u8, std.mem.trimStart(u8, command, " "), "rm -rf /")) return "refusing to delete from the root";
    return null;
}

fn handle(h: *hook.Hook) !void {
    // Typed: a tool call always carries its input, so a missing command is an error, and this entry fails closed.
    const bash = try h.toolInput(hook.events.tools.Bash);
    if (refusal(bash.command)) |reason| return h.deny(reason);
    h.noop();
}

test "refusal names the rule a command breaks" {
    try std.testing.expect(refusal("git push --force origin main") != null);
    try std.testing.expect(refusal("  rm -rf /") != null);
    try std.testing.expect(refusal("git push origin main") == null);
    try std.testing.expect(refusal("rm -rf ./build") == null);
}

test "the handler denies on both hosts, lets other commands through, and fails closed" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    const claude = try hook.testing.respond(a, handle, .{
        .event = "PreToolUse",
        .input = "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push --force\"}}",
    });
    try std.testing.expect(std.mem.indexOf(u8, claude.?, "\"permissionDecision\":\"deny\"") != null);

    // Copilot answers in its own flat shape; the same handler serves both.
    const copilot = try hook.testing.respond(a, handle, .{
        .host = .copilot,
        .event = "PreToolUse",
        .input = "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git push --force\"}}",
    });
    try std.testing.expectEqualStrings(
        "{\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"force pushes are not allowed in this project\"}",
        copilot.?,
    );

    const passed = try hook.testing.respond(a, handle, .{
        .event = "PreToolUse",
        .input = "{\"tool_input\":{\"command\":\"ls\"}}",
    });
    try std.testing.expectEqualStrings("{}", passed.?);

    // An input with no command is an error: nothing is sent, or a deny when the entry is failClosed.
    const broken = "{\"tool_input\":{}}";
    try std.testing.expect((try hook.testing.respond(a, handle, .{ .event = "PreToolUse", .input = broken })) == null);
    const closed = try hook.testing.respond(a, handle, .{ .event = "PreToolUse", .input = broken, .fail_closed = true });
    try std.testing.expect(std.mem.indexOf(u8, closed.?, "\"deny\"") != null);
}
```

**Change for your plugin:** the rules in `refusal`. Drop `failClosed` for a hook that must not block work when it breaks.

## Recipe: Startup context

Adds a line to the agent's context when a session starts. Both hosts take context on `SessionStart`.

```ts
hooks: {
	SessionStart: [{ matcher: "startup", binary: "hooks/bin/startup-context", timeout: 5 }],
}
```

```zig
const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

fn handle(h: *hook.Hook) !void {
    const source = h.input("source") orelse "unknown";
    // Build text with the hook's arena; nothing needs freeing, the process is about to exit.
    const text = try std.fmt.allocPrint(h.arena, "{s} is loaded on {s} ({s})", .{ h.plugin, @tagName(h.host), source });
    try h.context(text);
}

test "the context names the plugin, the host and how the session started" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const answer = try hook.testing.respond(arena.allocator(), handle, .{
        .event = "SessionStart",
        .input = "{\"source\":\"startup\"}",
        .plugin = "acme",
    });
    try std.testing.expectEqualStrings(
        "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"acme is loaded on claude (startup)\"}}",
        answer.?,
    );
}
```

**Change for your plugin:** the text. Copilot calls a fresh session `new`; the build widens the `startup` matcher for it.

## Recipe: Post-edit reaction

Tells the agent something about a file it just edited. `h.input("tool_input.file_path")` reads Claude Code's name; on Copilot the library finds the same value under `path`.

```ts
hooks: {
	PostToolUse: [{ matcher: "Edit|Write", binary: "hooks/bin/post-edit", timeout: 5 }],
}
```

```zig
const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

/// What to tell the agent about an edited file, or null to say nothing.
fn advice(path: []const u8) ?[]const u8 {
    if (std.mem.endsWith(u8, path, ".generated.ts")) return "is generated: edit its source and regenerate instead";
    if (std.mem.indexOf(u8, path, "/migrations/") != null) return "is a migration: never edit one that has shipped";
    return null;
}

fn handle(h: *hook.Hook) !void {
    // Read by Claude Code's name; on Copilot the library finds the same value under `path`.
    const path = h.input("tool_input.file_path") orelse return h.noop();
    const note = advice(path) orelse return h.noop();
    try h.context(try std.fmt.allocPrint(h.arena, "{s} {s}.", .{ path, note }));
}

test "advice is given for generated files and migrations only" {
    try std.testing.expect(advice("/repo/src/api.generated.ts") != null);
    try std.testing.expect(advice("/repo/db/migrations/001.sql") != null);
    try std.testing.expect(advice("/repo/src/app.ts") == null);
}

test "the handler reads the edited path from either host's input" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const a = arena.allocator();
    const claude = try hook.testing.respond(a, handle, .{
        .event = "PostToolUse",
        .input = "{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"/repo/src/api.generated.ts\"}}",
    });
    try std.testing.expect(std.mem.indexOf(u8, claude.?, "is generated") != null);
    const copilot = try hook.testing.respond(a, handle, .{
        .host = .copilot,
        .event = "PostToolUse",
        .input = "{\"tool_name\":\"Edit\",\"tool_input\":{\"path\":\"/repo/src/api.generated.ts\",\"old_str\":\"a\",\"new_str\":\"b\"}}",
    });
    try std.testing.expect(std.mem.indexOf(u8, copilot.?, "\"additionalContext\":\"/repo/src/api.generated.ts is generated") != null);
    const other = try hook.testing.respond(a, handle, .{
        .event = "PostToolUse",
        .input = "{\"tool_input\":{\"file_path\":\"/repo/src/app.ts\"}}",
    });
    try std.testing.expectEqualStrings("{}", other.?);
}
```

**Change for your plugin:** the rules in `advice`.

## Recipe: Stop gate

Keeps the agent working while a marker file exists. It checks `stop_hook_active` first: a stop hook that blocks while it is already continuing loops.

```ts
hooks: {
	Stop: [{ binary: "hooks/bin/stop-gate", timeout: 5 }],
}
```

```zig
const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

fn handle(h: *hook.Hook) !void {
    // A stop hook that blocks while it is already continuing loops, so block once only.
    if (h.input("stop_hook_active")) |active| {
        if (std.mem.eql(u8, active, "true")) return h.noop();
    }
    const marker = try std.fs.path.join(h.arena, &.{ h.projectDir(), ".needs-review" });
    if (!h.exists(marker)) return h.noop();
    const reason = "Finish the review noted in .needs-review, then delete the file.";
    // Claude Code and Copilot both honour a block on Stop; where a host does not, add context instead.
    if (h.can(.block)) return h.block(reason);
    try h.context(reason);
}

test "a stop that is already continuing is never blocked again" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const answer = try hook.testing.respond(arena.allocator(), handle, .{
        .event = "Stop",
        .input = "{\"stop_hook_active\":true,\"cwd\":\"/repo\"}",
    });
    try std.testing.expectEqualStrings("{}", answer.?);
}
```

**Change for your plugin:** the marker and the reason. `h.can(.block)` is the pattern for a capability one host may lack.

## Recipe: Branch guard

Asks before a commit lands on a protected branch. It runs `git` with `h.exec`, which runs in the project and captures the output. The `if` narrows the hook on Claude Code so no process starts for other commands; Copilot has no `if`, so the handler checks the command too.

```ts
hooks: {
	PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/branch-guard", timeout: 10, if: "Bash(git commit *)" }],
}
```

```zig
const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

fn protected(branch: []const u8) bool {
    return std.mem.eql(u8, branch, "main") or std.mem.startsWith(u8, branch, "release/");
}

fn handle(h: *hook.Hook) !void {
    const command = h.input("tool_input.command") orelse return h.noop();
    // The entry's `if` already narrows this on Claude Code; Copilot has no `if`, so check here too.
    if (std.mem.indexOf(u8, command, "git commit") == null) return h.noop();

    // Runs in the project, with its output captured: nothing it prints reaches the hook's stdout.
    const git = h.exec(&.{ "git", "branch", "--show-current" }) catch |err| {
        h.log("could not run git: {s}", .{@errorName(err)});
        return h.noop();
    };
    if (!git.ok()) return h.noop();
    const branch = git.text();
    if (!protected(branch)) return h.noop();
    try h.ask(try std.fmt.allocPrint(h.arena, "This commits straight to {s}. Continue?", .{branch}));
}

test "main and release branches are protected" {
    try std.testing.expect(protected("main"));
    try std.testing.expect(protected("release/1.2"));
    try std.testing.expect(!protected("feat/x"));
}

test "a command that is not a commit is let through without running git" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const answer = try hook.testing.respond(arena.allocator(), handle, .{
        .event = "PreToolUse",
        .input = "{\"tool_input\":{\"command\":\"git status\"}}",
    });
    try std.testing.expectEqualStrings("{}", answer.?);
}
```

**Change for your plugin:** the branches in `protected` and the command it runs.
