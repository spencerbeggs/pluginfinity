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
