const std = @import("std");
const hooks = @import("pluginfinity_hooks");

pub fn build(b: *std.Build) void {
    hooks.addHooks(b, .{
        .names = &.{ "command-guard", "startup-context", "post-edit", "stop-gate", "branch-guard" },
    });
}
