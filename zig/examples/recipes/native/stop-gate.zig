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
