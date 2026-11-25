//! A hook that sends whichever response its input asks for, so a test can run
//! every helper on every event and check each answer against the event's schema.

const std = @import("std");
const hook = @import("hook");

pub const panic = hook.panic;

pub fn main(init: std.process.Init) void {
    hook.run(init, handle);
}

fn handle(h: *hook.Hook) !void {
    const respond = h.input("respond") orelse return h.noop();
    const is = struct {
        fn eq(a: []const u8, b: []const u8) bool {
            return std.mem.eql(u8, a, b);
        }
    }.eq;
    if (is(respond, "deny")) return h.deny("a reason");
    if (is(respond, "allow")) return h.allow("a reason");
    if (is(respond, "allow, no reason")) return h.allow(null);
    if (is(respond, "ask")) return h.ask("a reason");
    if (is(respond, "context")) return h.context("some context");
    if (is(respond, "block")) return h.block("a reason");
    if (is(respond, "allow, rewritten input")) return h.allowWith("a reason", .{ .command = "ls" });
    if (is(respond, "system message")) return h.systemMessage("a message");
    if (is(respond, "raw")) return h.raw(.claude, .{ .systemMessage = "raw" });
    if (is(respond, "log")) {
        h.log("a line for {s}", .{"the error log"});
        h.debug("a line for the debug log", .{});
        return h.noop();
    }
    if (is(respond, "exec")) {
        const ran = try h.exec(&.{ "sh", "-c", h.input("script").? });
        return h.context(try std.fmt.allocPrint(h.arena, "{?d}|{s}|{s}|{}", .{ ran.code, ran.text(), ran.stderr, ran.ok() }));
    }
    if (is(respond, "exec with")) {
        const ran = try h.execWith(&.{ "sh", "-c", h.input("script").? }, .{
            .unset = &.{ "PF_TEST_STALE", "PF_TEST_BOTH" },
            .set = &.{ .{ "PF_TEST_FRESH", "fresh" }, .{ "PF_TEST_BOTH", "set wins" } },
        });
        return h.context(ran.text());
    }
    if (is(respond, "write file")) {
        try h.writeFile(h.input("path").?, h.input("text").?);
        return h.noop();
    }
    if (is(respond, "data dir")) return h.context(h.dataDir() orelse "none");
    if (is(respond, "exists")) return h.context(if (h.exists(h.input("path").?)) "yes" else "no");
    if (is(respond, "read file")) return h.context(h.readFile(h.input("path").?) orelse "unreadable");
    if (is(respond, "project dir")) return h.context(h.projectDir());
    if (is(respond, "session dir")) return h.context(h.sessionDir());
    if (is(respond, "cd project")) {
        try h.cdProject();
        return h.context(try std.process.currentPathAlloc(h.io.?, h.arena));
    }
    if (is(respond, "tool name")) return h.context(h.toolName(h.input("tool").?) orelse "none");
    if (is(respond, "tool prefix")) return h.context(h.toolPrefix(h.input("server").?) orelse "none");
    if (is(respond, "has skill")) return h.context(if (h.has(.skill, h.input("name").?)) "yes" else "no");
    if (is(respond, "env")) return h.context(h.env(h.input("name").?) orelse "undeclared");
    if (is(respond, "env set")) {
        h.envSet(h.input("name").?, h.input("value").?);
        return h.noop();
    }
    if (is(respond, "rewake")) return h.rewake("the tests failed");
    if (is(respond, "typed")) {
        const event = try h.as(hook.events.PreToolUse);
        const bash = try h.toolInput(hook.events.tools.Bash);
        return h.context(try std.fmt.allocPrint(h.arena, "{s}: {s}", .{ event.tool_name, bash.command }));
    }
    if (is(respond, "relay")) return h.relay(h.input("response").?);
    if (is(respond, "crash")) return error.Crashed;
    if (is(respond, "panic")) {
        var items = [_]u8{ 1, 2, 3 };
        const index = respond.len + 100;
        items[index] = 0;
    }
    h.noop();
}
