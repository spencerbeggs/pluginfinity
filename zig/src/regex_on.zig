//! The matcher's regular-expression support, for a plugin that built its hooks
//! with `addHooks(.{ .regex = true })`.
//!
//! Claude Code tests a matcher with JavaScript's `RegExp.prototype.test`: a
//! match anywhere in the value. The engine here is linear-time and has no
//! lookaround or backreferences; it refuses such a pattern by name rather than
//! answer wrongly, and the caller then lets the hook run.

const std = @import("std");
const regex = @import("regex");

pub const enabled = true;

pub fn isMatch(arena: std.mem.Allocator, pattern: []const u8, value: []const u8) !bool {
    var compiled = try regex.compile(arena, pattern, .{});
    defer compiled.deinit();
    return compiled.isMatch(value, .{});
}

test "a pattern is tested anywhere in the value, as Claude Code does" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    try std.testing.expect(try isMatch(a.allocator(), "^start", "startup"));
    try std.testing.expect(!try isMatch(a.allocator(), "^start", "restart"));
    try std.testing.expect(try isMatch(a.allocator(), "opus", "claude-opus-5"));
    try std.testing.expect(try isMatch(a.allocator(), "^(startup|new)$", "new"));
    try std.testing.expect(!try isMatch(a.allocator(), "^my-plugin:reviewer$", "my-plugin:reviewer2"));
}

test "a pattern the engine cannot evaluate is an error, never a wrong answer" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    try std.testing.expectError(error.UnsupportedLookaround, isMatch(a.allocator(), "^(?!startup).*$", "resume"));
    try std.testing.expectError(error.UnsupportedBackreference, isMatch(a.allocator(), "(a)\\1", "aa"));
    try std.testing.expect(std.meta.isError(isMatch(a.allocator(), "(", "x")));
}
