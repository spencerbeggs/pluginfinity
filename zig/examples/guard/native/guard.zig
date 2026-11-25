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
