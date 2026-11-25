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
