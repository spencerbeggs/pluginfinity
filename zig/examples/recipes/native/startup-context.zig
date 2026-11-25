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
