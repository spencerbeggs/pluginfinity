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
