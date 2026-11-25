const std = @import("std");
const hooks = @import("pluginfinity_hooks");

pub fn build(b: *std.Build) void {
    hooks.addHooks(b, .{ .names = &.{"guard"} });
}
