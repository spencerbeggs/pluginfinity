//! The matcher's regular-expression support for a plugin that has not opted
//! in: every pattern is declined, and the regex engine is not linked.

const std = @import("std");

pub const enabled = false;

pub fn isMatch(_: std.mem.Allocator, _: []const u8, _: []const u8) error{RegexNotEnabled}!bool {
    return error.RegexNotEnabled;
}
