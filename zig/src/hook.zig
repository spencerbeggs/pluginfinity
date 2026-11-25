//! Prototype native hook library: the Zig counterpart of lib/pluginfinity/hook.sh.
//!
//! A hook is one small program. `run` reads the host's JSON event from stdin,
//! hands the handler a `Hook`, and guarantees the process exits 0 with at most
//! one JSON response. Entry facts arrive as environment variables, as they do
//! for the bash library: PLUGINFINITY_HOST, PLUGINFINITY_EVENT,
//! PLUGINFINITY_FAIL_CLOSED, PLUGINFINITY_PLUGIN, PLUGINFINITY_MATCHER and
//! PLUGINFINITY_DEBUG.
//!
//! The build also hands a hook its plugin root as PLUGINFINITY_ROOT, where
//! `lib/pluginfinity/facts.json` holds what the bash library reads from
//! generated shell files: the host's tool names, the components this build
//! ships and the plugin's declared session variables.
//!
//! A hook should also take the library's panic handler, so a panic follows the
//! entry's fail policy instead of exiting non-zero:
//!
//!     pub const panic = hook.panic;

const std = @import("std");
const matcher_regex = @import("matcher_regex");
const Allocator = std.mem.Allocator;
const Value = std.json.Value;

pub const Host = enum {
    claude,
    copilot,

    pub fn parse(text: ?[]const u8) Host {
        const t = text orelse return .claude;
        return std.meta.stringToEnum(Host, t) orelse .claude;
    }
};

pub const events = @import("events.zig");

pub const Capability = enum { noop, deny, allow, ask, context, block, system_message };

/// Whether `host` honours `cap` on `event`. Mirrors hook_supports in hook.sh.
pub fn supports(host: Host, cap: Capability, event: []const u8) bool {
    return switch (cap) {
        .noop => true,
        // Claude Code takes the same decision on a model switch, and only a deny
        // before a skill's injected shell command.
        .deny => eql(event, "PreToolUse") or
            (host == .claude and oneOf(event, &.{ "PreModelSwitch", "PreSkillShellCommand" })),
        .allow, .ask => eql(event, "PreToolUse") or (host == .claude and eql(event, "PreModelSwitch")),
        .context => switch (host) {
            .claude => oneOf(event, &.{
                "SessionStart",        "SubagentStart", "PostModelSwitch", "UserPromptSubmit",
                "UserPromptExpansion", "PreToolUse",    "PostToolUse",     "PostToolUseFailure",
                "PostToolBatch",       "Stop",          "SubagentStop",
            }),
            .copilot => oneOf(event, &.{ "SessionStart", "SubagentStart", "PostToolUse", "Notification" }),
        },
        // Claude Code discards a systemMessage on these, or hands it somewhere the user does not see.
        .system_message => host == .claude and !oneOf(event, &.{
            "Setup",        "InstructionsLoaded", "MessageDisplay", "Notification",      "StopFailure",
            "ConfigChange", "DirectoryAdded",     "WorktreeCreate", "WorktreeRemove",    "PreCompact",
            "PostCompact",  "SessionEnd",         "Elicitation",    "ElicitationResult",
        }),
        .block => switch (host) {
            .claude => oneOf(event, &.{
                "UserPromptSubmit", "UserPromptExpansion", "PreSkillShellCommand", "PostToolUse",
                "PostToolBatch",    "Stop",                "SubagentStop",         "ConfigChange",
                "PreCompact",       "TaskCreated",         "TaskCompleted",        "TeammateIdle",
                "PreModelSwitch",   "Elicitation",         "ElicitationResult",
            }),
            .copilot => oneOf(event, &.{ "Stop", "SubagentStop" }),
        },
    };
}

fn eql(a: []const u8, b: []const u8) bool {
    return std.mem.eql(u8, a, b);
}

fn oneOf(needle: []const u8, haystack: []const []const u8) bool {
    for (haystack) |item| if (eql(needle, item)) return true;
    return false;
}

// --- input ------------------------------------------------------------------

/// Parse the event. Anything that is not a JSON object reads as null.
pub fn parseInput(arena: Allocator, bytes: []const u8) ?Value {
    const v = std.json.parseFromSliceLeaky(Value, arena, bytes, .{}) catch return null;
    return if (v == .object) v else null;
}

fn getPath(root: Value, segments: []const []const u8) ?Value {
    var cur = root;
    for (segments) |seg| {
        if (cur != .object) return null;
        cur = cur.object.get(seg) orelse return null;
    }
    return if (cur == .null) null else cur;
}

/// Copilot keeps its own tool_input key names under Claude tool names.
fn alias(key: []const u8) ?[]const u8 {
    const pairs = [_][2][]const u8{
        .{ "file_path", "path" },
        .{ "content", "file_text" },
        .{ "old_string", "old_str" },
        .{ "new_string", "new_str" },
    };
    for (pairs) |p| if (eql(key, p[0])) return p[1];
    return null;
}

fn camel(arena: Allocator, snake: []const u8) ![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    var upper = false;
    for (snake) |c| {
        if (c == '_') {
            upper = true;
        } else {
            try out.append(arena, if (upper) std.ascii.toUpper(c) else c);
            upper = false;
        }
    }
    return out.items;
}

/// Look a field up by its Claude name (dotted for nested keys), falling back to
/// Copilot's spelling of the same field: toolName, toolArgs (an object or a
/// JSON string), camelCase top-level keys and Copilot's tool_input key names.
pub fn lookup(arena: Allocator, root: Value, path: []const u8) !?Value {
    var segs: std.ArrayList([]const u8) = .empty;
    var it = std.mem.splitScalar(u8, path, '.');
    while (it.next()) |s| try segs.append(arena, s);
    const p = segs.items;

    if (getPath(root, p)) |v| return v;
    if (p.len == 0) return null;

    if (eql(p[0], "tool_input")) {
        if (p.len == 2) if (alias(p[1])) |other| {
            if (getPath(root, &.{ p[0], other })) |v| return v;
        };
        var args = root.object.get("toolArgs") orelse return null;
        if (args == .string) args = parseInput(arena, args.string) orelse return null;
        if (getPath(args, p[1..])) |v| return v;
        if (p.len == 2) if (alias(p[1])) |other| return getPath(args, &.{other});
        return null;
    }
    if (eql(p[0], "tool_name")) return getPath(root, &.{"toolName"});

    const head = try camel(arena, p[0]);
    const rest = try std.mem.concat(arena, []const u8, &.{ &.{head}, p[1..] });
    return getPath(root, rest);
}

// --- responses ----------------------------------------------------------------

pub const Decision = enum { allow, deny, ask };

const json_opts: std.json.Stringify.Options = .{ .emit_null_optional_fields = false };

fn jsonText(arena: Allocator, value: anytype) ![]u8 {
    return std.json.Stringify.valueAlloc(arena, value, json_opts);
}

/// A permission decision in the host's own shape. Claude Code names the event
/// it answers. `updated_input` is JSON text that replaces the tool's input:
/// `updatedInput` on Claude Code, `modifiedArgs` on Copilot.
pub fn renderPermission(
    arena: Allocator,
    host: Host,
    event: []const u8,
    decision: Decision,
    reason: ?[]const u8,
    updated_input: ?[]const u8,
) ![]u8 {
    var body: std.ArrayList(u8) = .empty;
    if (host == .claude) {
        try body.appendSlice(arena, "\"hookEventName\":");
        try body.appendSlice(arena, try jsonText(arena, event));
        try body.append(arena, ',');
    }
    try body.appendSlice(arena, "\"permissionDecision\":");
    try body.appendSlice(arena, try jsonText(arena, @tagName(decision)));
    if (reason) |r| {
        try body.appendSlice(arena, ",\"permissionDecisionReason\":");
        try body.appendSlice(arena, try jsonText(arena, r));
    }
    if (updated_input) |input| {
        try body.appendSlice(arena, if (host == .copilot) ",\"modifiedArgs\":" else ",\"updatedInput\":");
        try body.appendSlice(arena, input);
    }
    return switch (host) {
        .copilot => std.fmt.allocPrint(arena, "{{{s}}}", .{body.items}),
        .claude => std.fmt.allocPrint(arena, "{{\"hookSpecificOutput\":{{{s}}}}}", .{body.items}),
    };
}

pub fn renderContext(arena: Allocator, host: Host, event: []const u8, text: []const u8) ![]u8 {
    return switch (host) {
        .copilot => std.json.Stringify.valueAlloc(arena, .{ .additionalContext = text }, json_opts),
        .claude => std.json.Stringify.valueAlloc(arena, .{
            .hookSpecificOutput = .{ .hookEventName = event, .additionalContext = text },
        }, json_opts),
    };
}

pub fn renderBlock(arena: Allocator, reason: []const u8) ![]u8 {
    return std.json.Stringify.valueAlloc(arena, .{ .decision = "block", .reason = reason }, json_opts);
}

// --- matcher ----------------------------------------------------------------------

/// Claude Code's matcher rules, for a host that ignores the matcher on an
/// event: empty or `*` matches all, and a value of only letters, digits, `_`,
/// `-`, spaces, `,` and `|` is an exact list split on `|` or `,`. Anything else
/// is a regular expression, which is not decided here: null.
pub fn matcherApplies(matcher: []const u8, value: []const u8) ?bool {
    if (matcher.len == 0 or eql(matcher, "*")) return true;
    for (matcher) |c| {
        if (!(std.ascii.isAlphanumeric(c) or c == '_' or c == '-' or c == ' ' or c == ',' or c == '|')) return null;
    }
    var items = std.mem.tokenizeAny(u8, matcher, "|,");
    while (items.next()) |item| {
        if (eql(std.mem.trim(u8, item, " "), value)) return true;
    }
    return false;
}

/// The input field a matcher filters on, for the events a host ignores it on.
fn matchField(event: []const u8) ?[]const u8 {
    if (eql(event, "SessionStart")) return "source";
    if (eql(event, "SessionEnd")) return "reason";
    if (eql(event, "SubagentStop")) return "agent_type";
    return null;
}

// --- logging ----------------------------------------------------------------------

/// One log line, in the shape every pluginfinity library writes:
/// `<ISO-8601 UTC> [<host>] hook/<script>: <message>`.
pub fn logLine(arena: Allocator, epoch_seconds: u64, host: Host, script: []const u8, message: []const u8) ![]u8 {
    const secs: std.time.epoch.EpochSeconds = .{ .secs = epoch_seconds };
    const year_day = secs.getEpochDay().calculateYearDay();
    const month_day = year_day.calculateMonthDay();
    const day = secs.getDaySeconds();
    return std.fmt.allocPrint(arena, "{d:0>4}-{d:0>2}-{d:0>2}T{d:0>2}:{d:0>2}:{d:0>2}Z [{s}] hook/{s}: {s}\n", .{
        year_day.year,         month_day.month.numeric(), @as(u8, month_day.day_index) + 1,
        day.getHoursIntoDay(), day.getMinutesIntoHour(),  day.getSecondsIntoMinute(),
        @tagName(host),        script,                    message,
    });
}

/// What a program run with `Hook.exec` did.
pub const Exec = struct {
    /// The exit code, or null when the program was ended by a signal.
    code: ?u8,
    stdout: []const u8,
    stderr: []const u8,

    pub fn ok(self: Exec) bool {
        return self.code == 0;
    }

    /// stdout with the trailing newline removed, as `$(...)` gives a shell.
    pub fn text(self: Exec) []const u8 {
        return std.mem.trimEnd(u8, self.stdout, "\r\n");
    }
};

// --- facts the build writes ---------------------------------------------------------

pub const Component = enum { skill, agent, monitor, server };

/// What `lib/pluginfinity/facts.json` holds. Every field has a default, so a
/// file from an older build still reads.
pub const Facts = struct {
    tools: struct {
        /// Claude Code tool name to the host's run-time name.
        names: Value = .null,
        /// The plugin's name on Claude Code, which own MCP tools are written under.
        plugin: []const u8 = "",
        /// The host's own MCP tool name, with `{plugin}`, `{server}` and `{tool}`.
        mcp: []const u8 = "",
        servers: []const []const u8 = &.{},
        /// Whether a name the table does not list is kept as it is, or has no name here.
        unlisted: []const u8 = "keep",
    } = .{},
    has: struct {
        skills: []const []const u8 = &.{},
        agents: []const []const u8 = &.{},
        monitors: []const []const u8 = &.{},
        servers: []const []const u8 = &.{},
    } = .{},
    env: struct {
        /// Declared session variable to its default.
        vars: Value = .null,
    } = .{},

    pub fn envDefault(self: *const Facts, name: []const u8) ?[]const u8 {
        if (self.env.vars != .object) return null;
        const value = self.env.vars.object.get(name) orelse return null;
        return if (value == .string) value.string else "";
    }

    pub fn toolName(self: *const Facts, arena: Allocator, name: []const u8) ?[]const u8 {
        if (name.len == 0) return null;
        if (self.tools.names == .object) if (self.tools.names.object.get(name)) |spelled| {
            if (spelled == .string) return spelled.string;
        };
        const own = std.fmt.allocPrint(arena, "mcp__plugin_{s}_", .{self.tools.plugin}) catch return null;
        if (self.tools.mcp.len > 0 and std.mem.startsWith(u8, name, own)) {
            // Try each "__" as the boundary between server and tool, as the build does.
            const rest = name[own.len..];
            var at: usize = 0;
            while (std.mem.indexOfPos(u8, rest, at, "__")) |split| : (at = split + 2) {
                const server = rest[0..split];
                const tool = rest[split + 2 ..];
                if (server.len == 0 or tool.len == 0 or !oneOf(server, self.tools.servers)) continue;
                return fill(arena, self.tools.mcp, self.tools.plugin, server, tool) catch null;
            }
        }
        return if (eql(self.tools.unlisted, "keep")) name else null;
    }

    pub fn toolPrefix(self: *const Facts, arena: Allocator, server: []const u8) ?[]const u8 {
        if (server.len == 0 or self.tools.mcp.len == 0 or !oneOf(server, self.tools.servers)) return null;
        const spelled = fill(arena, self.tools.mcp, self.tools.plugin, server, "{tool}") catch return null;
        return spelled[0 .. std.mem.indexOf(u8, spelled, "{tool}") orelse spelled.len];
    }
};

fn fill(arena: Allocator, template: []const u8, plugin: []const u8, server: []const u8, tool: []const u8) ![]u8 {
    const a = try std.mem.replaceOwned(u8, arena, template, "{plugin}", plugin);
    const b = try std.mem.replaceOwned(u8, arena, a, "{server}", server);
    return std.mem.replaceOwned(u8, arena, b, "{tool}", tool);
}

pub fn parseFacts(arena: Allocator, bytes: []const u8) !Facts {
    return std.json.parseFromSliceLeaky(Facts, arena, bytes, .{ .ignore_unknown_fields = true });
}

// --- session values ----------------------------------------------------------------

/// A usable session id: not empty, not `.`, and with no `/`, `..`, `\` or control character.
pub fn validSessionId(id: []const u8) bool {
    if (id.len == 0 or eql(id, ".") or std.mem.indexOf(u8, id, "..") != null) return false;
    for (id) |c| if (c == '/' or c == '\\' or std.ascii.isControl(c)) return false;
    return true;
}

/// The value of `name` in a session values file (`NAME=value` lines), or null.
pub fn valueIn(text: []const u8, name: []const u8) ?[]const u8 {
    var lines = std.mem.splitScalar(u8, text, '\n');
    while (lines.next()) |line| {
        const eq = std.mem.indexOfScalar(u8, line, '=') orelse continue;
        if (eql(line[0..eq], name)) return line[eq + 1 ..];
    }
    return null;
}

fn hasLine(text: []const u8, wanted: []const u8) bool {
    var lines = std.mem.splitScalar(u8, text, '\n');
    while (lines.next()) |line| if (eql(line, wanted)) return true;
    return false;
}

// Session values are private to the user, as the bash library's umask 077 makes them.
const Permissions = std.Io.File.Permissions;
const private_dir: Permissions = if (@hasDecl(Permissions, "fromMode")) Permissions.fromMode(0o700) else .default_dir;
const private_file: Permissions = if (@hasDecl(Permissions, "fromMode")) Permissions.fromMode(0o600) else .default_file;

/// The declared session variables and their resolved values, in declaration order.
pub const SessionEnv = struct {
    names: []const []const u8,
    values: [][]const u8,
    /// The session's directory, or null when no valid session is known.
    dir: ?[]const u8 = null,
    project: ?[]const u8 = null,

    pub fn index(self: *const SessionEnv, name: []const u8) ?usize {
        for (self.names, 0..) |each, i| if (eql(each, name)) return i;
        return null;
    }

    /// Take a session values file over the current values (`NAME=value`, the
    /// value literal to the end of the line), marking each declared name it holds.
    pub fn apply(self: *SessionEnv, text: []const u8, got: ?[]bool) void {
        var lines = std.mem.splitScalar(u8, text, '\n');
        while (lines.next()) |line| {
            const eq = std.mem.indexOfScalar(u8, line, '=') orelse continue;
            const at = self.index(line[0..eq]) orelse continue;
            self.values[at] = line[eq + 1 ..];
            if (got) |marks| marks[at] = true;
        }
    }

    /// Take a `.env` file over the current values: `KEY=value` or `export
    /// KEY=value`, one matching pair of quotes stripped, nothing expanded,
    /// declared names only.
    pub fn applyDotenv(self: *SessionEnv, text: []const u8) void {
        var lines = std.mem.splitScalar(u8, text, '\n');
        while (lines.next()) |raw| {
            var line = std.mem.trimStart(u8, std.mem.trimEnd(u8, raw, "\r"), " \t");
            if (std.mem.startsWith(u8, line, "export ") or std.mem.startsWith(u8, line, "export\t")) {
                line = std.mem.trimStart(u8, line["export".len..], " \t");
            }
            const eq = std.mem.indexOfScalar(u8, line, '=') orelse continue;
            const at = self.index(line[0..eq]) orelse continue;
            var value = line[eq + 1 ..];
            if (value.len >= 2) {
                const first = value[0];
                if ((first == '"' or first == '\'') and value[value.len - 1] == first) value = value[1 .. value.len - 1];
            }
            self.values[at] = value;
        }
    }
};

/// The name of a project's pointer file: what `cksum` prints for the
/// directory, as `<crc>-<length>`, which is how the bash library names it.
pub fn projectKey(arena: Allocator, project: []const u8) ![]u8 {
    var crc = std.hash.crc.@"CRC-32/CKSUM".init();
    crc.update(project);
    // POSIX cksum also feeds the length, least significant byte first.
    var length = project.len;
    while (length > 0) : (length >>= 8) crc.update(&.{@as(u8, @truncate(length))});
    return std.fmt.allocPrint(arena, "{d}-{d}", .{ crc.final(), project.len });
}

/// `export NAME='value'` with the value single-quoted for a shell.
pub fn shellExport(arena: Allocator, name: []const u8, value: []const u8) ![]u8 {
    const quoted = try std.mem.replaceOwned(u8, arena, value, "'", "'\\''");
    return std.fmt.allocPrint(arena, "export {s}='{s}'\n", .{ name, quoted });
}

// --- the Claude Code shape of an input ----------------------------------------------

fn textOf(value: ?Value) ?[]const u8 {
    const v = value orelse return null;
    return if (v == .string) v.string else null;
}

fn snakeCase(arena: Allocator, camel_case: []const u8) ![]const u8 {
    var out: std.ArrayList(u8) = .empty;
    for (camel_case) |c| {
        if (std.ascii.isUpper(c)) {
            try out.append(arena, '_');
            try out.append(arena, std.ascii.toLower(c));
        } else try out.append(arena, c);
    }
    return out.items;
}

/// `root` the way Claude Code would send it; see `Hook.envelope`.
pub fn claudeEnvelope(arena: Allocator, host: Host, event: []const u8, root: Value) !Value {
    if (root != .object) return error.NoInput;
    var out: std.json.ObjectMap = .empty;
    var it = root.object.iterator();
    while (it.next()) |entry| {
        const key = entry.key_ptr.*;
        if (host != .copilot) {
            try out.put(arena, key, entry.value_ptr.*);
            continue;
        }
        if (eql(key, "toolName")) {
            try out.put(arena, "tool_name", entry.value_ptr.*);
        } else if (eql(key, "toolArgs") or eql(key, "tool_input")) {
            var args = entry.value_ptr.*;
            if (args == .string) args = parseInput(arena, args.string) orelse args;
            if (args == .object) {
                // Copilot keeps its own key names; add Claude Code's beside them where absent.
                var fixed: std.json.ObjectMap = .empty;
                var inner = args.object.iterator();
                while (inner.next()) |field| try fixed.put(arena, field.key_ptr.*, field.value_ptr.*);
                const pairs = [_][2][]const u8{
                    .{ "path", "file_path" },
                    .{ "file_text", "content" },
                    .{ "old_str", "old_string" },
                    .{ "new_str", "new_string" },
                };
                for (pairs) |pair| if (args.object.get(pair[0])) |theirs| {
                    if (args.object.get(pair[1]) == null) try fixed.put(arena, pair[1], theirs);
                };
                args = .{ .object = fixed };
            }
            try out.put(arena, "tool_input", args);
        } else {
            try out.put(arena, try snakeCase(arena, key), entry.value_ptr.*);
        }
    }
    if (out.get("hook_event_name") == null and event.len > 0) try out.put(arena, "hook_event_name", .{ .string = event });
    return .{ .object = out };
}

// --- the hook -------------------------------------------------------------------

pub const Hook = struct {
    arena: Allocator,
    host: Host,
    event: []const u8,
    plugin: []const u8,
    fail_closed: bool,
    /// The parsed event, or null when stdin held no JSON object.
    root: ?Value,
    /// The one response this run sends. A second response is ignored.
    response: ?[]const u8 = null,
    /// The hook program's name, for log lines.
    script: []const u8 = "hook",
    /// Whether PLUGINFINITY_DEBUG=1.
    debug_on: bool = false,
    /// Set by `run`; without them (in a unit test) logging does nothing.
    io: ?std.Io = null,
    state_dir: ?[]const u8 = null,
    /// The process environment. Null in a unit test, where `env_overrides` stands in.
    environ: ?*const std.process.Environ.Map = null,
    /// The plugin root the build handed over, or null when it did not.
    plugin_root: ?[]const u8 = null,
    /// Whether the entry sets `asyncRewake`, so the hook may wake the agent.
    async_rewake: bool = false,
    rewake_message: ?[]const u8 = null,
    facts: ?Facts = null,
    facts_loaded: bool = false,
    session_env: ?SessionEnv = null,
    session_env_loaded: bool = false,

    /// A field as text: a string as it is, anything else as JSON. Null when missing.
    pub fn input(self: *Hook, path: []const u8) ?[]const u8 {
        const root = self.root orelse return null;
        const v = (lookup(self.arena, root, path) catch return null) orelse return null;
        return switch (v) {
            .string => |s| s,
            else => std.json.Stringify.valueAlloc(self.arena, v, .{}) catch null,
        };
    }

    pub fn can(self: *const Hook, cap: Capability) bool {
        return supports(self.host, cap, self.event);
    }

    fn emit(self: *Hook, body: []const u8) void {
        if (self.response == null) self.response = body;
    }

    pub fn noop(self: *Hook) void {
        self.emit("{}");
    }

    /// A helper the host does not honour on this event answers with a no-op.
    fn unsupported(self: *Hook, name: []const u8) void {
        self.debug("{s} does nothing on {s} for {s}", .{ name, @tagName(self.host), self.event });
        self.noop();
    }

    fn permission(self: *Hook, decision: Decision, reason: ?[]const u8, updated_input: ?[]const u8) !void {
        const cap: Capability = switch (decision) {
            .deny => .deny,
            .allow => .allow,
            .ask => .ask,
        };
        if (!self.can(cap)) return self.unsupported(@tagName(decision));
        // Only a tool call has an input to replace.
        const replacement = if (eql(self.event, "PreToolUse")) updated_input else null;
        if (updated_input != null and replacement == null) self.debug("allow: {s} takes no updated input", .{self.event});
        self.emit(try renderPermission(self.arena, self.host, self.event, decision, reason, replacement));
    }

    pub fn deny(self: *Hook, reason: []const u8) !void {
        return self.permission(.deny, reason, null);
    }

    pub fn allow(self: *Hook, reason: ?[]const u8) !void {
        return self.permission(.allow, reason, null);
    }

    /// Allow the tool call with its input replaced. `new_input` is any value that
    /// serializes to a JSON object, and it replaces the whole input, so include
    /// the fields that do not change. On Copilot use Copilot's key names.
    pub fn allowWith(self: *Hook, reason: ?[]const u8, new_input: anytype) !void {
        return self.permission(.allow, reason, try jsonText(self.arena, new_input));
    }

    pub fn ask(self: *Hook, reason: ?[]const u8) !void {
        return self.permission(.ask, reason, null);
    }

    pub fn context(self: *Hook, text: []const u8) !void {
        if (!self.can(.context)) return self.unsupported("context");
        self.emit(try renderContext(self.arena, self.host, self.event, text));
    }

    pub fn block(self: *Hook, reason: []const u8) !void {
        if (!self.can(.block)) return self.unsupported("block");
        self.emit(try renderBlock(self.arena, reason));
    }

    /// Show the user a message. It is not added to the model's context.
    pub fn systemMessage(self: *Hook, text: []const u8) !void {
        if (!self.can(.system_message)) return self.unsupported("systemMessage");
        self.emit(try jsonText(self.arena, .{ .systemMessage = text }));
    }

    /// Send a response only one host understands, as it is. Does nothing on the
    /// other host. `value` is anything that serializes to a JSON object; the
    /// hook event schemas say what each event reads.
    pub fn raw(self: *Hook, host: Host, value: anytype) !void {
        if (host != self.host) {
            self.debug("raw for {s} skipped on {s}", .{ @tagName(host), @tagName(self.host) });
            return;
        }
        self.emit(try jsonText(self.arena, value));
    }

    /// Append a line to the plugin's error log. Never fails.
    pub fn log(self: *Hook, comptime fmt: []const u8, args: anytype) void {
        self.write("error.log", fmt, args);
    }

    /// Append a line to the plugin's debug log when PLUGINFINITY_DEBUG=1. Never fails.
    pub fn debug(self: *Hook, comptime fmt: []const u8, args: anytype) void {
        if (self.debug_on) self.write("debug.log", fmt, args);
    }

    fn write(self: *Hook, file: []const u8, comptime fmt: []const u8, args: anytype) void {
        const io = self.io orelse return;
        const dir = self.state_dir orelse return;
        const message = std.fmt.allocPrint(self.arena, fmt, args) catch return;
        const now = std.Io.Timestamp.now(io, .real).toSeconds();
        const line = logLine(self.arena, @intCast(@max(now, 0)), self.host, self.script, message) catch return;
        const path = std.fmt.allocPrint(self.arena, "{s}/{s}", .{ dir, file }) catch return;
        const cwd = std.Io.Dir.cwd();
        cwd.createDirPath(io, dir) catch return;
        const out = cwd.createFile(io, path, .{ .truncate = false }) catch return;
        defer out.close(io);
        const end = out.length(io) catch return;
        out.writePositionalAll(io, line, end) catch return;
    }

    // --- where the hook runs -------------------------------------------------------

    /// A process environment variable, or null when it is unset or empty.
    pub fn getenv(self: *const Hook, name: []const u8) ?[]const u8 {
        const map = self.environ orelse return null;
        const value = map.get(name) orelse return null;
        return if (value.len == 0) null else value;
    }

    /// Whether a file or directory is at `path` (absolute, or relative to the working directory).
    pub fn exists(self: *const Hook, path: []const u8) bool {
        const io = self.io orelse return false;
        std.Io.Dir.cwd().access(io, path, .{}) catch return false;
        return true;
    }

    /// The contents of a file of up to 1 MiB, or null when it cannot be read.
    pub fn readFile(self: *Hook, path: []const u8) ?[]const u8 {
        return self.readText(path);
    }

    /// Run a program in `projectDir` and wait for it, with its output captured:
    /// `try h.exec(&.{ "git", "status", "--porcelain" })`. Nothing the program
    /// prints reaches the hook's own stdout. A program that cannot be started is
    /// an error; one that exits non-zero is not, so check `ok()` or `code`.
    pub fn exec(self: *Hook, argv: []const []const u8) !Exec {
        const io = self.io orelse return error.NoIo;
        const result = try std.process.run(self.arena, io, .{
            .argv = argv,
            .cwd = .{ .path = self.projectDir() },
            .stdout_limit = .limited(1024 * 1024),
            .stderr_limit = .limited(1024 * 1024),
        });
        return .{
            .code = switch (result.term) {
                .exited => |code| code,
                else => null,
            },
            .stdout = result.stdout,
            .stderr = result.stderr,
        };
    }

    /// The closest directory at or above `start` holding `.git` (a directory, or a file in a worktree).
    fn gitRoot(self: *const Hook, start: []const u8) ?[]const u8 {
        var probe = start;
        while (probe.len > 1) {
            const marker = std.fs.path.join(self.arena, &.{ probe, ".git" }) catch return null;
            if (self.exists(marker)) return probe;
            probe = std.fs.path.dirname(probe) orelse return null;
        }
        return null;
    }

    fn workingDir(self: *const Hook) []const u8 {
        const io = self.io orelse return ".";
        return std.process.currentPathAlloc(io, self.arena) catch ".";
    }

    /// Where this call runs: the input's `cwd` walked up to the nearest `.git`,
    /// else that `cwd`. With no absolute `cwd`: `CLAUDE_PROJECT_DIR` on Claude
    /// Code, else the working directory (walked up to `.git` on Claude Code
    /// only, since Copilot runs hooks from the plugin root).
    pub fn projectDir(self: *Hook) []const u8 {
        if (self.input("cwd")) |cwd| if (std.fs.path.isAbsolute(cwd)) return self.gitRoot(cwd) orelse cwd;
        const here = self.workingDir();
        if (self.host == .claude) {
            if (self.getenv("CLAUDE_PROJECT_DIR")) |dir| return dir;
            if (self.gitRoot(here)) |root| return root;
        }
        return here;
    }

    /// The session's project: `CLAUDE_PROJECT_DIR` on Claude Code when set, else
    /// `projectDir`. In a git worktree the two differ.
    pub fn sessionDir(self: *Hook) []const u8 {
        if (self.host == .claude) if (self.getenv("CLAUDE_PROJECT_DIR")) |dir| return dir;
        return self.projectDir();
    }

    /// Change into `projectDir`, before running a CLI that finds its project
    /// from the working directory. Logs and returns the error when it cannot.
    pub fn cdProject(self: *Hook) !void {
        const io = self.io orelse return error.NoIo;
        const dir = self.projectDir();
        std.process.setCurrentPath(io, dir) catch |err| {
            self.log("cdProject: cannot cd to {s}", .{dir});
            return err;
        };
    }

    // --- what this build ships -----------------------------------------------------

    fn loadFacts(self: *Hook) ?*const Facts {
        if (!self.facts_loaded) {
            self.facts_loaded = true;
            if (self.facts == null) self.facts = self.readFacts();
        }
        return if (self.facts) |*facts| facts else null;
    }

    fn readFacts(self: *Hook) ?Facts {
        const io = self.io orelse return null;
        const root = self.plugin_root orelse return null;
        const path = std.fs.path.join(self.arena, &.{ root, "lib", "pluginfinity", "facts.json" }) catch return null;
        const bytes = std.Io.Dir.cwd().readFileAlloc(io, path, self.arena, .limited(1024 * 1024)) catch {
            self.debug("no facts at {s}", .{path});
            return null;
        };
        return parseFacts(self.arena, bytes) catch {
            self.log("facts at {s} are not readable", .{path});
            return null;
        };
    }

    /// The host's run-time name for a Claude Code tool, such as `view` for
    /// `Read` on Copilot, or null when the host has none. An own MCP tool is
    /// written `mcp__plugin_<plugin>_<server>__<tool>`, as Claude Code names it.
    /// Without facts (a build that wrote none) the name is returned as given.
    pub fn toolName(self: *Hook, name: []const u8) ?[]const u8 {
        const facts = self.loadFacts() orelse return name;
        return facts.toolName(self.arena, name);
    }

    /// The run-time prefix of one of this plugin's own MCP servers, or null for
    /// a server the plugin does not declare.
    pub fn toolPrefix(self: *Hook, server: []const u8) ?[]const u8 {
        const facts = self.loadFacts() orelse return null;
        return facts.toolPrefix(self.arena, server);
    }

    /// Whether this host's build ships a component.
    pub fn has(self: *Hook, kind: Component, name: []const u8) bool {
        const facts = self.loadFacts() orelse return false;
        return oneOf(name, switch (kind) {
            .skill => facts.has.skills,
            .agent => facts.has.agents,
            .monitor => facts.has.monitors,
            .server => facts.has.servers,
        });
    }

    // --- session env ---------------------------------------------------------------
    //
    // The same chain the bash library walks, over the same files. Lowest first:
    // the config default, the setup script's output (which only the SessionStart
    // runner applies), <project>/.env, <project>/.env.local, the process
    // environment, then `envSet`. The runner resolves the first five once and
    // writes the session values file; a reader takes that file as authoritative
    // and evaluates the chain live, without setup, only for a name the file
    // lacks or when there is no file.

    fn sessionEnv(self: *Hook) ?*SessionEnv {
        if (!self.session_env_loaded) {
            self.session_env_loaded = true;
            self.session_env = self.resolveEnv() catch null;
        }
        return if (self.session_env) |*resolved| resolved else null;
    }

    fn readText(self: *Hook, path: []const u8) ?[]const u8 {
        const io = self.io orelse return null;
        return std.Io.Dir.cwd().readFileAlloc(io, path, self.arena, .limited(1024 * 1024)) catch null;
    }

    /// The project whose `.env` files and pointer apply, as a physical path
    /// walked up to `.git`. Copilot runs hooks from the plugin root, which is no
    /// project, so there it takes an absolute `cwd` in the input or nothing.
    fn envProject(self: *Hook) ?[]const u8 {
        if (self.host == .copilot) {
            const cwd = self.input("cwd") orelse return null;
            if (!std.fs.path.isAbsolute(cwd)) return null;
        }
        const dir = self.projectDir();
        const io = self.io orelse return dir;
        const physical: []const u8 = std.Io.Dir.realPathFileAbsoluteAlloc(io, dir, self.arena) catch dir;
        return self.gitRoot(physical) orelse physical;
    }

    /// The session the pointer for `project` names, when it names this very project.
    fn pointerSession(self: *Hook, project: []const u8) ?[]const u8 {
        const state = self.state_dir orelse return null;
        const path = std.fs.path.join(self.arena, &.{ state, "project", projectKey(self.arena, project) catch return null }) catch return null;
        const text = self.readText(path) orelse return null;
        var lines = std.mem.splitScalar(u8, text, '\n');
        const id = lines.next() orelse return null;
        const dir = lines.next() orelse return null;
        return if (eql(dir, project) and validSessionId(id)) id else null;
    }

    fn nap(self: *Hook) void {
        const io = self.io orelse return;
        std.Io.sleep(io, .fromMilliseconds(100), .awake) catch {};
    }

    fn resolveEnv(self: *Hook) !?SessionEnv {
        const facts = self.loadFacts() orelse return null;
        if (facts.env.vars != .object or facts.env.vars.object.count() == 0) return null;
        const declared = facts.env.vars.object;
        const names = try self.arena.alloc([]const u8, declared.count());
        const defaults = try self.arena.alloc([]const u8, declared.count());
        const values = try self.arena.alloc([]const u8, declared.count());
        const got = try self.arena.alloc(bool, declared.count());
        var it = declared.iterator();
        var n: usize = 0;
        while (it.next()) |entry| : (n += 1) {
            names[n] = entry.key_ptr.*;
            defaults[n] = if (entry.value_ptr.* == .string) entry.value_ptr.string else "";
        }
        const project = self.envProject();

        // Which session: the input's id, else Claude Code's own variable when its
        // values file exists, else the project's latest, through the pointer.
        var session: ?[]const u8 = null;
        const given = self.input("session_id") orelse "";
        if (given.len > 0) {
            if (validSessionId(given)) session = given else self.log("env: invalid session id; session values not read", .{});
        } else {
            if (self.getenv("CLAUDE_CODE_SESSION_ID")) |id| if (validSessionId(id)) {
                if (self.sessionFile(id, "env")) |file| if (self.exists(file)) {
                    session = id;
                };
            };
            if (session == null) if (project) |dir| {
                session = self.pointerSession(dir);
            };
        }
        const session_dir: ?[]const u8 = if (session) |id| self.sessionFile(id, "") else null;
        const file: ?[]const u8 = if (session) |id| self.sessionFile(id, "env") else null;

        // Claude Code runs an event's hooks side by side, so at SessionStart the
        // runner may not have finished: wait up to 3 s for its done marker.
        if (given.len > 0 and file != null and !self.exists(file.?) and eql(self.event, "SessionStart")) {
            const done = self.sessionFile(session.?, "done").?;
            var ticks: usize = 0;
            while (!self.exists(done) and ticks < 30) : (ticks += 1) self.nap();
            if (!self.exists(done)) self.log("env: the env runner had not finished after 3s; resolving live", .{});
        }

        var resolved: SessionEnv = .{ .names = names, .values = values, .dir = session_dir, .project = project };
        @memcpy(values, defaults);
        @memset(got, false);
        const recorded = if (file) |path| self.readText(path) else null;
        if (recorded) |text| {
            resolved.apply(text, got);
            if (std.mem.indexOfScalar(bool, got, false) != null) {
                // A name the file lacks (declared after SessionStart) resolves live; the file's values win.
                @memcpy(values, defaults);
                self.liveEnv(&resolved);
                resolved.apply(text, got);
            }
        } else {
            self.debug("env: no session values; resolving live", .{});
            self.liveEnv(&resolved);
        }
        return resolved;
    }

    fn sessionFile(self: *Hook, id: []const u8, file: []const u8) ?[]const u8 {
        const state = self.state_dir orelse return null;
        return std.fs.path.join(self.arena, &.{ state, "session", id, file }) catch null;
    }

    /// Rungs 3 to 5 over the current values: the project's `.env`, its `.env.local`, then the process environment.
    fn liveEnv(self: *Hook, resolved: *SessionEnv) void {
        if (resolved.project) |project| {
            for ([_][]const u8{ ".env", ".env.local" }) |name| {
                const path = std.fs.path.join(self.arena, &.{ project, name }) catch continue;
                if (!self.exists(path)) continue;
                const text = self.readText(path) orelse {
                    self.log("env: cannot read {s}; skipped", .{path});
                    continue;
                };
                resolved.applyDotenv(text);
            }
        }
        const map = self.environ orelse return;
        for (resolved.names, 0..) |name, i| if (map.get(name)) |value| {
            if (std.mem.indexOfScalar(u8, value, '\n') != null) {
                self.log("env: ambient {s} holds a newline; ignored", .{name});
            } else resolved.values[i] = value;
        };
    }

    /// The value of a session variable the plugin's config declares, resolved as
    /// the bash library resolves it: what the session recorded, else the chain
    /// evaluated live. Null for a name the config does not declare.
    pub fn env(self: *Hook, name: []const u8) ?[]const u8 {
        const resolved = self.sessionEnv() orelse return null;
        const at = resolved.index(name) orelse {
            self.debug("env: {s} is not a declared session variable", .{name});
            return null;
        };
        return resolved.values[at];
    }

    /// Set a declared session variable from an event that can produce one
    /// (SessionStart, Setup, CwdChanged, FileChanged): record it for later hooks
    /// and, on Claude Code, append it to CLAUDE_ENV_FILE for the model's shell.
    /// A refusal is a log line; this never fails, so it cannot abort a hook.
    pub fn envSet(self: *Hook, name: []const u8, value: []const u8) void {
        const resolved = self.sessionEnv() orelse return self.log("envSet: no session env is declared in this build", .{});
        if (!oneOf(self.event, &.{ "SessionStart", "Setup", "CwdChanged", "FileChanged" })) {
            return self.debug("envSet {s} ignored: {s} does not produce session values", .{ name, self.event });
        }
        const at = resolved.index(name) orelse return self.log("envSet: cannot set {s}: not a declared session variable", .{name});
        if (std.mem.indexOfScalar(u8, value, '\n') != null) return self.log("envSet: cannot set {s}: the value holds a newline", .{name});
        const io = self.io orelse return;
        const dir = resolved.dir orelse return self.log("envSet: cannot set {s}: no session", .{name});
        const cwd = std.Io.Dir.cwd();
        _ = cwd.createDirPathStatus(io, dir, private_dir) catch return self.log("envSet: cannot create {s}", .{dir});
        const file = std.fs.path.join(self.arena, &.{ dir, "env" }) catch return;

        // Under the lock, keep every other name as the file has it (a name it lacks
        // keeps its resolved value), then write the file whole and swap it in.
        const held = self.lockSession(dir);
        defer if (held) self.unlockSession(dir);
        if (self.readText(file)) |text| resolved.apply(text, null);
        resolved.values[at] = value;
        var next: std.ArrayList(u8) = .empty;
        for (resolved.names, resolved.values) |each, current| next.print(self.arena, "{s}={s}\n", .{ each, current }) catch return;
        const tmp = std.fmt.allocPrint(self.arena, "{s}.tmp", .{file}) catch return;
        cwd.writeFile(io, .{ .sub_path = tmp, .data = next.items, .flags = .{ .permissions = private_file } }) catch {
            return self.log("envSet: cannot write {s}", .{tmp});
        };
        cwd.rename(tmp, cwd, file, io) catch return self.log("envSet: cannot write {s}", .{file});

        // The runner keeps a name listed here across a rerun of SessionStart.
        const set_path = std.fs.path.join(self.arena, &.{ dir, "set" }) catch return;
        if (!hasLine(self.readText(set_path) orelse "", name)) {
            self.append(set_path, std.fmt.allocPrint(self.arena, "{s}\n", .{name}) catch return);
        }

        if (self.host == .claude) {
            const env_file = self.getenv("CLAUDE_ENV_FILE") orelse {
                return self.log("envSet: CLAUDE_ENV_FILE is not set; the Bash tool will not see {s}", .{name});
            };
            self.append(env_file, shellExport(self.arena, name, value) catch return);
        }
    }

    /// Take the lock around a read-merge-write of the session's values: a
    /// directory, with bounded retry (about 5 s). A lock older than 10 s, or one
    /// still without its time after 2 s, is stale and removed. On timeout, log
    /// and write anyway. Returns whether the lock is held.
    fn lockSession(self: *Hook, dir: []const u8) bool {
        const io = self.io orelse return false;
        const cwd = std.Io.Dir.cwd();
        const lock = std.fs.path.join(self.arena, &.{ dir, "lock" }) catch return false;
        const at = std.fs.path.join(self.arena, &.{ lock, "at" }) catch return false;
        var ticks: usize = 0;
        var without_time: usize = 0;
        while (ticks < 50) {
            if (cwd.createDir(io, lock, private_dir)) |_| {
                const now = std.Io.Timestamp.now(io, .real).toSeconds();
                cwd.writeFile(io, .{ .sub_path = at, .data = std.fmt.allocPrint(self.arena, "{d}\n", .{now}) catch "" }) catch {};
                return true;
            } else |_| {}
            const stamp = if (self.readText(at)) |text| std.fmt.parseInt(i64, std.mem.trim(u8, text, " \n"), 10) catch null else null;
            var stale = false;
            if (stamp) |since| {
                stale = std.Io.Timestamp.now(io, .real).toSeconds() - since > 10;
            } else {
                without_time += 1;
                stale = without_time > 20;
            }
            if (stale) {
                self.debug("env: removing a stale lock", .{});
                cwd.deleteFile(io, at) catch {};
                cwd.deleteDir(io, lock) catch {};
                without_time = 0;
                continue;
            }
            self.nap();
            ticks += 1;
        }
        self.log("env: the session values lock is held too long; writing without it", .{});
        return false;
    }

    fn unlockSession(self: *Hook, dir: []const u8) void {
        const io = self.io orelse return;
        const cwd = std.Io.Dir.cwd();
        const lock = std.fs.path.join(self.arena, &.{ dir, "lock" }) catch return;
        cwd.deleteFile(io, std.fs.path.join(self.arena, &.{ lock, "at" }) catch return) catch {};
        cwd.deleteDir(io, lock) catch {};
    }

    fn append(self: *Hook, path: []const u8, bytes: []const u8) void {
        const io = self.io orelse return;
        const out = std.Io.Dir.cwd().createFile(io, path, .{ .truncate = false, .permissions = private_file }) catch return;
        defer out.close(io);
        const end = out.length(io) catch return;
        out.writePositionalAll(io, bytes, end) catch return;
    }

    // --- other shapes --------------------------------------------------------------

    /// The input the way Claude Code would send it. On Copilot: snake_case
    /// top-level keys, `toolName` and `toolArgs` as `tool_name` and `tool_input`
    /// (parsed when a string), Copilot's `tool_input` key names mapped to Claude
    /// Code's where the Claude key is absent, and `hook_event_name` filled in.
    pub fn envelope(self: *Hook) !Value {
        const root = self.root orelse return error.NoInput;
        return claudeEnvelope(self.arena, self.host, self.event, root);
    }

    /// The event as one of the generated types in `events`, for example
    /// `try h.as(hook.events.PreToolUse)`. Fields are read from `envelope`, so
    /// the same type serves both hosts; a key the type does not name is ignored.
    pub fn as(self: *Hook, comptime T: type) !T {
        return std.json.parseFromValueLeaky(T, self.arena, try self.envelope(), .{ .ignore_unknown_fields = true });
    }

    /// The tool's arguments as one of the generated types in `events.tools`,
    /// for example `try h.toolInput(hook.events.tools.Bash)`.
    pub fn toolInput(self: *Hook, comptime T: type) !T {
        const value = try self.envelope();
        const args = getPath(value, &.{"tool_input"}) orelse return error.NoToolInput;
        return std.json.parseFromValueLeaky(T, self.arena, args, .{ .ignore_unknown_fields = true });
    }

    /// Answer with a response written in Claude Code's shape, by whichever
    /// helper fits, so each host's rules apply. First match wins: a permission
    /// decision, a block, additional context, a system message, then a no-op.
    pub fn relay(self: *Hook, response_json: []const u8) !void {
        const response = parseInput(self.arena, response_json) orelse {
            self.log("relay: not a JSON object", .{});
            return error.NotJson;
        };
        const specific = getPath(response, &.{"hookSpecificOutput"});
        if (specific) |s| if (getPath(s, &.{"permissionDecision"})) |decision| if (decision == .string) {
            if (std.meta.stringToEnum(Decision, decision.string)) |d| {
                const reason = textOf(getPath(s, &.{"permissionDecisionReason"}));
                const updated = if (d == .allow) getPath(s, &.{"updatedInput"}) else null;
                return self.permission(d, reason, if (updated) |u| try jsonText(self.arena, u) else null);
            }
        };
        if (getPath(response, &.{"decision"})) |decision| if (decision == .string and eql(decision.string, "block")) {
            return self.block(textOf(getPath(response, &.{"reason"})) orelse "");
        };
        if (specific) |s| if (textOf(getPath(s, &.{"additionalContext"}))) |text| return self.context(text);
        if (textOf(getPath(response, &.{"systemMessage"}))) |text| return self.systemMessage(text);
        self.noop();
    }

    /// Wake the agent from a background hook, with a message it will read. Only
    /// an entry that sets `asyncRewake: true` may; on any other entry this logs
    /// and does nothing, since the exit code it uses would block the action.
    pub fn rewake(self: *Hook, message: []const u8) void {
        if (!self.async_rewake) return self.log("rewake: this entry does not set asyncRewake; ignored", .{});
        self.rewake_message = message;
    }

    /// What a failed handler answers with: nothing (fail open), or a deny or
    /// block where the entry is failClosed and the host honours one.
    pub fn failClosed(self: *Hook, err: anyerror) void {
        if (!self.fail_closed or self.response != null) return;
        // A block on these sends a teammate back to work, and it cannot repair a hook that fails.
        if (oneOf(self.event, &.{ "TaskCompleted", "TeammateIdle" })) return;
        // A stop hook that fails while already continuing must not block again, or it loops.
        if (oneOf(self.event, &.{ "Stop", "SubagentStop" })) {
            if (self.input("stop_hook_active")) |active| if (eql(active, "true")) return;
        }
        const reason = std.fmt.allocPrint(self.arena, "{s} hook failed ({s})", .{ self.plugin, @errorName(err) }) catch return;
        if (self.can(.deny)) {
            self.emit(renderPermission(self.arena, self.host, self.event, .deny, reason, null) catch return);
        } else if (self.can(.block)) {
            self.emit(renderBlock(self.arena, reason) catch return);
        }
    }
};

// The running hook, for the panic handler.
var running: ?*Hook = null;
var panicking = false;

fn flush(h: *Hook) void {
    const io = h.io orelse return;
    const body = h.response orelse return;
    const out = std.Io.File.stdout();
    out.writeStreamingAll(io, body) catch {};
    out.writeStreamingAll(io, "\n") catch {};
}

fn onPanic(message: []const u8, _: ?usize) noreturn {
    // A panic while handling a panic: give up, failing closed if nothing was sent.
    if (panicking) std.process.exit(1);
    panicking = true;
    const h = running orelse std.process.exit(1);
    h.log("panicked during {s}: {s}", .{ if (h.event.len == 0) "an unknown event" else h.event, message });
    if (h.response == null) {
        h.failClosed(error.Panicked);
        flush(h);
    }
    // Fail open with a clean exit. A closed guard that could send nothing exits 1,
    // which Claude Code blocks on (onFailure) and Copilot denies on preToolUse.
    std.process.exit(if (h.fail_closed and h.response == null and h.can(.deny)) 1 else 0);
}

/// The library's panic handler: `pub const panic = hook.panic;` in the hook's
/// root file. A panic then follows the entry's fail policy, like a returned
/// error, and is written to the error log.
pub const panic = std.debug.FullPanic(onPanic);

fn scriptName(init: std.process.Init) []const u8 {
    // The allocating form is the one that also works on Windows.
    var args = init.minimal.args.iterateAllocator(init.arena.allocator()) catch return "hook";
    const first = args.next() orelse return "hook";
    return std.fs.path.basename(first);
}

fn stateDir(arena: Allocator, env: *const std.process.Environ.Map, plugin: []const u8) ?[]const u8 {
    if (env.get("XDG_STATE_HOME")) |base| if (base.len > 0) {
        return std.fmt.allocPrint(arena, "{s}/pluginfinity/{s}", .{ base, plugin }) catch null;
    };
    const home = env.get("HOME") orelse return null;
    return std.fmt.allocPrint(arena, "{s}/.local/state/pluginfinity/{s}", .{ home, plugin }) catch null;
}

/// The whole life of a hook process. Call it from `main` and return.
pub fn run(init: std.process.Init, comptime handler: fn (*Hook) anyerror!void) void {
    const arena = init.arena.allocator();
    const env = init.environ_map;

    const stdin = std.Io.File.stdin();
    var bytes: []const u8 = "";
    // A terminal on stdin (a hand run) reads as no input.
    if (!(stdin.isTty(init.io) catch false)) {
        var buf: [4096]u8 = undefined;
        var reader = stdin.readerStreaming(init.io, &buf);
        bytes = reader.interface.allocRemaining(arena, .limited(16 * 1024 * 1024)) catch "";
    }
    const root = parseInput(arena, bytes);

    var event: []const u8 = env.get("PLUGINFINITY_EVENT") orelse "";
    if (event.len == 0) if (root) |r| if (getPath(r, &.{"hook_event_name"})) |v| {
        if (v == .string) event = v.string;
    };
    const plugin = env.get("PLUGINFINITY_PLUGIN") orelse "unknown";

    var hook: Hook = .{
        .arena = arena,
        .host = Host.parse(env.get("PLUGINFINITY_HOST")),
        .event = event,
        .plugin = plugin,
        .fail_closed = if (env.get("PLUGINFINITY_FAIL_CLOSED")) |v| eql(v, "1") else false,
        .root = root,
        .script = scriptName(init),
        .debug_on = if (env.get("PLUGINFINITY_DEBUG")) |v| eql(v, "1") else false,
        .io = init.io,
        .state_dir = stateDir(arena, env, plugin),
        .environ = env,
        .plugin_root = env.get("PLUGINFINITY_ROOT"),
        .async_rewake = if (env.get("PLUGINFINITY_ASYNC_REWAKE")) |v| eql(v, "1") else false,
    };
    running = &hook;
    if (hook.debug_on) hook.debug("input: {s}", .{bytes[0..@min(bytes.len, 4000)]});

    // A host that ignores this event's matcher has the build pass it here.
    if (env.get("PLUGINFINITY_MATCHER")) |matcher| if (matchField(event)) |field| {
        const value = hook.input(field) orelse "";
        if (matcherApplies(matcher, value)) |applies| {
            if (!applies) {
                hook.debug("matcher {s} did not match {s}", .{ matcher, value });
                return;
            }
        } else if (matcher_regex.isMatch(arena, matcher, value)) |applies| {
            if (!applies) {
                hook.debug("matcher {s} did not match {s}", .{ matcher, value });
                return;
            }
        } else |err| {
            // Never skip a hook over a pattern that could not be read: it runs, and says why.
            if (matcher_regex.enabled) {
                hook.log("matcher {s} could not be applied ({s}); the hook ran", .{ matcher, @errorName(err) });
            } else {
                hook.log("matcher {s} is a regular expression, and these hooks were built without regex support; the hook ran. Build with addHooks(.{{ .regex = true }}), or write the matcher as a list", .{matcher});
            }
        }
    };

    if (root == null) {
        hook.log("malformed or empty JSON on stdin; skipping", .{});
        hook.noop();
    } else {
        handler(&hook) catch |err| {
            hook.log("failed during {s}: {s}", .{ if (event.len == 0) "an unknown event" else event, @errorName(err) });
            hook.failClosed(err);
        };
    }

    // An asyncRewake hook wakes the agent by exiting 2 with its message on stderr.
    if (hook.rewake_message) |message| {
        if (hook.debug_on) hook.debug("outcome: rewake", .{});
        const err = std.Io.File.stderr();
        err.writeStreamingAll(init.io, message) catch {};
        err.writeStreamingAll(init.io, "\n") catch {};
        std.process.exit(2);
    }

    if (hook.debug_on) hook.debug("outcome: {s}", .{hook.response orelse "none"});
    flush(&hook);
}

// --- testing a handler ------------------------------------------------------------

/// For a hook's own `test` blocks: run a whole handler against an input and
/// read what it would answer, with no process, stdin or files involved.
///
///     test "a force push is denied" {
///         var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
///         defer arena.deinit();
///         const answer = try hook.testing.respond(arena.allocator(), handle, .{
///             .event = "PreToolUse",
///             .input = "{\"tool_input\":{\"command\":\"git push --force\"}}",
///         });
///         try std.testing.expect(std.mem.indexOf(u8, answer.?, "\"deny\"") != null);
///     }
pub const testing = struct {
    pub const Options = struct {
        host: Host = .claude,
        event: []const u8,
        /// The event's JSON, as the host would send it.
        input: []const u8 = "{}",
        fail_closed: bool = false,
        plugin: []const u8 = "test-plugin",
        /// The build facts as JSON, for a handler that calls `toolName`, `has` or `env`.
        facts: ?[]const u8 = null,
        async_rewake: bool = false,
    };

    /// A hook as `run` would hand it to a handler. Logging does nothing.
    pub fn make(arena: Allocator, options: Options) Hook {
        return .{
            .arena = arena,
            .host = options.host,
            .event = options.event,
            .plugin = options.plugin,
            .fail_closed = options.fail_closed,
            .root = parseInput(arena, options.input),
            .async_rewake = options.async_rewake,
            .facts = if (options.facts) |json| parseFacts(arena, json) catch null else null,
        };
    }

    /// What the handler answers: the response JSON, or null when it sends
    /// nothing. A handler that returns an error is treated as `run` treats it.
    pub fn respond(arena: Allocator, comptime handler: fn (*Hook) anyerror!void, options: Options) !?[]const u8 {
        var h = make(arena, options);
        if (h.root == null) {
            h.noop();
        } else {
            handler(&h) catch |err| h.failClosed(err);
        }
        return h.response;
    }
};

// --- tests ------------------------------------------------------------------------

fn testHook(arena: Allocator, host: Host, event: []const u8, json: []const u8) Hook {
    if (true) return testing.make(arena, .{ .host = host, .event = event, .input = json });
    return .{
        .arena = arena,
        .host = host,
        .event = event,
        .plugin = "test-plugin",
        .fail_closed = false,
        .root = parseInput(arena, json),
    };
}

test "input reads a nested Claude field" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testHook(a.allocator(), .claude, "PreToolUse",
        \\{"tool_name":"Bash","tool_input":{"command":"ls -la"}}
    );
    try std.testing.expectEqualStrings("ls -la", h.input("tool_input.command").?);
    try std.testing.expectEqualStrings("Bash", h.input("tool_name").?);
    try std.testing.expect(h.input("tool_input.missing") == null);
}

test "input falls back to Copilot's spelling" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testHook(a.allocator(), .copilot, "PreToolUse",
        \\{"toolName":"bash","toolArgs":"{\"command\":\"ls\",\"path\":\"/x\"}","sessionId":"s1"}
    );
    try std.testing.expectEqualStrings("ls", h.input("tool_input.command").?);
    try std.testing.expectEqualStrings("bash", h.input("tool_name").?);
    try std.testing.expectEqualStrings("s1", h.input("session_id").?);
}

test "input maps Claude tool_input keys onto Copilot's names" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testHook(a.allocator(), .copilot, "PreToolUse",
        \\{"tool_name":"Edit","tool_input":{"path":"/x","old_str":"a"}}
    );
    try std.testing.expectEqualStrings("/x", h.input("tool_input.file_path").?);
    try std.testing.expectEqualStrings("a", h.input("tool_input.old_string").?);
}

test "a non-object input parses as null" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    try std.testing.expect(parseInput(a.allocator(), "") == null);
    try std.testing.expect(parseInput(a.allocator(), "[1]") == null);
    try std.testing.expect(parseInput(a.allocator(), "{nope") == null);
}

test "deny renders each host's shape" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    try std.testing.expectEqualStrings(
        \\{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no"}}
    , try renderPermission(a.allocator(), .claude, "PreToolUse", .deny, "no", null));
    try std.testing.expectEqualStrings(
        \\{"permissionDecision":"deny","permissionDecisionReason":"no"}
    , try renderPermission(a.allocator(), .copilot, "PreToolUse", .deny, "no", null));
}

test "a decision outside PreToolUse is a no-op" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testHook(a.allocator(), .claude, "PostToolUse", "{}");
    try h.deny("no");
    try std.testing.expectEqualStrings("{}", h.response.?);
}

test "only the first response counts" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testHook(a.allocator(), .copilot, "PreToolUse", "{}");
    try h.allow("fine");
    try h.deny("too late");
    try std.testing.expectEqualStrings(
        \\{"permissionDecision":"allow","permissionDecisionReason":"fine"}
    , h.response.?);
}

test "a failed handler fails open unless the entry is failClosed" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var open = testHook(a.allocator(), .claude, "PreToolUse", "{}");
    open.failClosed(error.Boom);
    try std.testing.expect(open.response == null);

    var closed = testHook(a.allocator(), .copilot, "PreToolUse", "{}");
    closed.fail_closed = true;
    closed.failClosed(error.Boom);
    try std.testing.expectEqualStrings(
        \\{"permissionDecision":"deny","permissionDecisionReason":"test-plugin hook failed (Boom)"}
    , closed.response.?);
}

test "a model switch takes a decision on Claude Code only, and names its own event" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var claude = testHook(a.allocator(), .claude, "PreModelSwitch", "{}");
    try claude.ask("costly");
    try std.testing.expectEqualStrings(
        \\{"hookSpecificOutput":{"hookEventName":"PreModelSwitch","permissionDecision":"ask","permissionDecisionReason":"costly"}}
    , claude.response.?);

    var copilot = testHook(a.allocator(), .copilot, "PreModelSwitch", "{}");
    try copilot.deny("no");
    try std.testing.expectEqualStrings("{}", copilot.response.?);
}

test "an injected skill command can be denied but not allowed or asked about" {
    try std.testing.expect(supports(.claude, .deny, "PreSkillShellCommand"));
    try std.testing.expect(supports(.claude, .block, "PreSkillShellCommand"));
    try std.testing.expect(!supports(.claude, .allow, "PreSkillShellCommand"));
    try std.testing.expect(!supports(.claude, .ask, "PreSkillShellCommand"));
}

test "failClosed never blocks where the agent could not recover" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    for ([_][]const u8{ "TaskCompleted", "TeammateIdle" }) |event| {
        var h = testHook(a.allocator(), .claude, event, "{}");
        h.fail_closed = true;
        h.failClosed(error.Boom);
        try std.testing.expect(h.response == null);
    }
    var looping = testHook(a.allocator(), .claude, "Stop",
        \\{"stop_hook_active":true}
    );
    looping.fail_closed = true;
    looping.failClosed(error.Boom);
    try std.testing.expect(looping.response == null);

    var first = testHook(a.allocator(), .claude, "Stop", "{}");
    first.fail_closed = true;
    first.failClosed(error.Boom);
    try std.testing.expect(first.response != null);
}

test "context reaches only the events a host honours" {
    try std.testing.expect(supports(.claude, .context, "UserPromptSubmit"));
    try std.testing.expect(!supports(.copilot, .context, "UserPromptSubmit"));
    try std.testing.expect(supports(.copilot, .block, "Stop"));
    try std.testing.expect(!supports(.copilot, .block, "PostToolUse"));
}

test "allowWith replaces the input under each host's key, on a tool call only" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var claude = testHook(a.allocator(), .claude, "PreToolUse", "{}");
    try claude.allowWith(null, .{ .command = "ls" });
    try std.testing.expectEqualStrings(
        \\{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":"ls"}}}
    , claude.response.?);

    var copilot = testHook(a.allocator(), .copilot, "PreToolUse", "{}");
    try copilot.allowWith("ok", .{ .command = "ls" });
    try std.testing.expectEqualStrings(
        \\{"permissionDecision":"allow","permissionDecisionReason":"ok","modifiedArgs":{"command":"ls"}}
    , copilot.response.?);

    var model = testHook(a.allocator(), .claude, "PreModelSwitch", "{}");
    try model.allowWith(null, .{ .model = "x" });
    try std.testing.expectEqualStrings(
        \\{"hookSpecificOutput":{"hookEventName":"PreModelSwitch","permissionDecision":"allow"}}
    , model.response.?);
}

test "a system message reaches the user on Claude Code, where the event keeps it" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var stop = testHook(a.allocator(), .claude, "Stop", "{}");
    try stop.systemMessage("hi");
    try std.testing.expectEqualStrings(
        \\{"systemMessage":"hi"}
    , stop.response.?);

    var notification = testHook(a.allocator(), .claude, "Notification", "{}");
    try notification.systemMessage("hi");
    try std.testing.expectEqualStrings("{}", notification.response.?);

    var copilot = testHook(a.allocator(), .copilot, "Stop", "{}");
    try copilot.systemMessage("hi");
    try std.testing.expectEqualStrings("{}", copilot.response.?);
}

test "raw sends a response on the named host only" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var claude = testHook(a.allocator(), .claude, "SessionStart", "{}");
    try claude.raw(.copilot, .{ .additionalContext = "x" });
    try std.testing.expect(claude.response == null);
    try claude.raw(.claude, .{ .hookSpecificOutput = .{ .hookEventName = "SessionStart", .sessionTitle = "t" } });
    try std.testing.expectEqualStrings(
        \\{"hookSpecificOutput":{"hookEventName":"SessionStart","sessionTitle":"t"}}
    , claude.response.?);
}

test "a matcher is an exact list split on bars or commas, and a regex is not decided" {
    try std.testing.expectEqual(true, matcherApplies("", "x").?);
    try std.testing.expectEqual(true, matcherApplies("*", "x").?);
    try std.testing.expectEqual(true, matcherApplies("startup|new|resume", "new").?);
    try std.testing.expectEqual(true, matcherApplies("startup, resume", "resume").?);
    try std.testing.expectEqual(false, matcherApplies("startup|resume", "clear").?);
    try std.testing.expectEqual(false, matcherApplies("startup", "startuppy").?);
    try std.testing.expect(matcherApplies("^start.*", "startup") == null);
}

test "a log line has the shape every pluginfinity library writes" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    // 2026-11-25T18:03:05Z
    try std.testing.expectEqualStrings(
        "2026-11-25T18:03:05Z [copilot] hook/guard-Linux-x86_64: it broke\n",
        try logLine(a.allocator(), 1795629785, .copilot, "guard-Linux-x86_64", "it broke"),
    );
    try std.testing.expectEqualStrings(
        "1970-01-01T00:00:00Z [claude] hook/h: m\n",
        try logLine(a.allocator(), 0, .claude, "h", "m"),
    );
}

const test_facts =
    \\{"tools":{"names":{"Read":"view","Bash":"bash"},"plugin":"acme","mcp":"{server}-{tool}","servers":["db","a__b"],"unlisted":"drop"},
    \\ "has":{"skills":["review"],"agents":[],"monitors":["beat"],"servers":["db"]},
    \\ "env":{"vars":{"ACME_COLOR":"blue","ACME_EMPTY":""}}}
;

test "toolName spells a tool the host's way, maps an own MCP tool, and has no name for the rest" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testing.make(a.allocator(), .{ .host = .copilot, .event = "PreToolUse", .facts = test_facts });
    try std.testing.expectEqualStrings("view", h.toolName("Read").?);
    try std.testing.expectEqualStrings("db-query", h.toolName("mcp__plugin_acme_db__query").?);
    // A server whose own name holds "__" is still found.
    try std.testing.expectEqualStrings("a__b-run", h.toolName("mcp__plugin_acme_a__b__run").?);
    try std.testing.expect(h.toolName("TodoWrite") == null);
    try std.testing.expect(h.toolName("mcp__plugin_acme_other__x") == null);
    try std.testing.expectEqualStrings("db-", h.toolPrefix("db").?);
    try std.testing.expect(h.toolPrefix("nope") == null);

    // Without facts a name is kept as given, and nothing is known to be shipped.
    var bare = testing.make(a.allocator(), .{ .event = "PreToolUse" });
    try std.testing.expectEqualStrings("Read", bare.toolName("Read").?);
    try std.testing.expect(!bare.has(.skill, "review"));
}

test "has answers for what this host's build ships" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testing.make(a.allocator(), .{ .event = "Stop", .facts = test_facts });
    try std.testing.expect(h.has(.skill, "review"));
    try std.testing.expect(h.has(.monitor, "beat"));
    try std.testing.expect(h.has(.server, "db"));
    try std.testing.expect(!h.has(.agent, "review"));
}

test "env reads a declared variable's default, and nothing undeclared" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testing.make(a.allocator(), .{ .event = "Stop", .facts = test_facts });
    try std.testing.expectEqualStrings("blue", h.env("ACME_COLOR").?);
    try std.testing.expectEqualStrings("", h.env("ACME_EMPTY").?);
    try std.testing.expect(h.env("PATH") == null);
}

test "session values, a dotenv file and the project key read as the bash library reads them" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    const names = [_][]const u8{ "A", "B", "C", "D", "E" };
    var values = [_][]const u8{ "a0", "b0", "c0", "d0", "e0" };
    var got = [_]bool{ false, false, false, false, false };
    var resolved: SessionEnv = .{ .names = &names, .values = &values };

    // The values file: literal to the end of the line, declared names only.
    resolved.apply("A=1\nB=two=2\nZ=ignored\nnot a pair\n", &got);
    try std.testing.expectEqualStrings("1", values[0]);
    try std.testing.expectEqualStrings("two=2", values[1]);
    try std.testing.expectEqualSlices(bool, &.{ true, true, false, false, false }, &got);

    // A .env file: export, leading space, a CR, and one matching pair of quotes stripped.
    resolved.applyDotenv("C=\"quoted value\"\r\n  export D='single'\nexport\tE=plain # kept\nZ=ignored\nA=\"unbalanced'\n");
    try std.testing.expectEqualStrings("quoted value", values[2]);
    try std.testing.expectEqualStrings("single", values[3]);
    try std.testing.expectEqualStrings("plain # kept", values[4]);
    try std.testing.expectEqualStrings("\"unbalanced'", values[0]);

    // `printf /Users/x/proj | cksum` prints 746814310 13.
    try std.testing.expectEqualStrings("746814310-13", try projectKey(a.allocator(), "/Users/x/proj"));
    try std.testing.expectEqualStrings("export A='it'\\''s'\n", try shellExport(a.allocator(), "A", "it's"));
    try std.testing.expect(validSessionId("abc-123"));
    for ([_][]const u8{ "", ".", "a/b", "a..b", "a\\b", "a\nb" }) |bad| try std.testing.expect(!validSessionId(bad));
}

test "envelope turns a Copilot input into the shape Claude Code sends" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var h = testing.make(a.allocator(), .{
        .host = .copilot,
        .event = "PreToolUse",
        .input =
        \\{"sessionId":"s1","toolName":"edit","toolArgs":"{\"path\":\"/x\",\"old_str\":\"a\",\"new_str\":\"b\"}"}
        ,
    });
    const shaped = try jsonText(a.allocator(), try h.envelope());
    try std.testing.expectEqualStrings(
        \\{"session_id":"s1","tool_name":"edit","tool_input":{"path":"/x","old_str":"a","new_str":"b","file_path":"/x","old_string":"a","new_string":"b"},"hook_event_name":"PreToolUse"}
    , shaped);

    var claude = testing.make(a.allocator(), .{ .event = "Stop", .input = "{\"stop_hook_active\":true}" });
    try std.testing.expectEqualStrings(
        \\{"stop_hook_active":true,"hook_event_name":"Stop"}
    , try jsonText(a.allocator(), try claude.envelope()));
}

test "as and toolInput read the event as generated types, on either host" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var claude = testing.make(a.allocator(), .{
        .event = "PreToolUse",
        .input =
        \\{"session_id":"s","hook_event_name":"PreToolUse","tool_name":"Bash","tool_use_id":"t1","tool_input":{"command":"ls","timeout":5},"a_new_field":1}
        ,
    });
    const event = try claude.as(events.PreToolUse);
    try std.testing.expectEqualStrings("Bash", event.tool_name);
    try std.testing.expectEqualStrings("s", event.session_id.?);
    try std.testing.expect(event.mcp_server == null);
    const bash = try claude.toolInput(events.tools.Bash);
    try std.testing.expectEqualStrings("ls", bash.command);
    try std.testing.expectEqual(@as(f64, 5), bash.timeout.?);

    var copilot = testing.make(a.allocator(), .{
        .host = .copilot,
        .event = "PreToolUse",
        .input =
        \\{"toolName":"edit","toolArgs":{"path":"/x","old_str":"a","new_str":"b"}}
        ,
    });
    const edit = try copilot.toolInput(events.tools.Edit);
    try std.testing.expectEqualStrings("/x", edit.file_path);
    try std.testing.expectEqualStrings("b", edit.new_string);

    var stop = testing.make(a.allocator(), .{ .event = "Stop", .input = "{\"hook_event_name\":\"Stop\",\"stop_hook_active\":true}" });
    try std.testing.expect((try stop.as(events.Stop)).stop_hook_active);
    // A field the event always sends is required: its absence is an error, not a guess.
    try std.testing.expectError(error.MissingField, stop.as(events.PreToolUse));
}

test "relay answers a Claude-shaped response through the helper that fits" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    const arena = a.allocator();
    var deny = testing.make(arena, .{ .host = .copilot, .event = "PreToolUse" });
    try deny.relay(
        \\{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no"}}
    );
    try std.testing.expectEqualStrings(
        \\{"permissionDecision":"deny","permissionDecisionReason":"no"}
    , deny.response.?);

    var rewrite = testing.make(arena, .{ .host = .copilot, .event = "PreToolUse" });
    try rewrite.relay(
        \\{"hookSpecificOutput":{"permissionDecision":"allow","updatedInput":{"command":"ls"}}}
    );
    try std.testing.expectEqualStrings(
        \\{"permissionDecision":"allow","modifiedArgs":{"command":"ls"}}
    , rewrite.response.?);

    var block = testing.make(arena, .{ .event = "Stop" });
    try block.relay("{\"decision\":\"block\",\"reason\":\"keep going\",\"systemMessage\":\"m\"}");
    try std.testing.expectEqualStrings("{\"decision\":\"block\",\"reason\":\"keep going\"}", block.response.?);

    var context = testing.make(arena, .{ .event = "SessionStart" });
    try context.relay("{\"hookSpecificOutput\":{\"additionalContext\":\"hi\"}}");
    try std.testing.expectEqualStrings(
        \\{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"hi"}}
    , context.response.?);

    var message = testing.make(arena, .{ .event = "Stop" });
    try message.relay("{\"systemMessage\":\"m\"}");
    try std.testing.expectEqualStrings("{\"systemMessage\":\"m\"}", message.response.?);

    var nothing = testing.make(arena, .{ .event = "Stop" });
    try nothing.relay("{}");
    try std.testing.expectEqualStrings("{}", nothing.response.?);
    try std.testing.expectError(error.NotJson, nothing.relay("not json"));
}

test "rewake is taken only on an entry that sets asyncRewake" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    var plain = testing.make(a.allocator(), .{ .event = "PostToolUse" });
    plain.rewake("tests failed");
    try std.testing.expect(plain.rewake_message == null);
    var waking = testing.make(a.allocator(), .{ .event = "PostToolUse", .async_rewake = true });
    waking.rewake("tests failed");
    try std.testing.expectEqualStrings("tests failed", waking.rewake_message.?);
}

fn sampleHandler(h: *Hook) !void {
    const cmd = h.input("tool_input.command") orelse return h.noop();
    if (std.mem.indexOf(u8, cmd, "boom") != null) return error.Boom;
    if (std.mem.indexOf(u8, cmd, "rm") != null) return h.deny("no");
    h.noop();
}

test "testing.respond runs a whole handler as run would" {
    var a = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer a.deinit();
    const arena = a.allocator();
    const denied = try testing.respond(arena, sampleHandler, .{ .event = "PreToolUse", .input = "{\"tool_input\":{\"command\":\"rm -rf x\"}}" });
    try std.testing.expect(std.mem.indexOf(u8, denied.?, "\"permissionDecision\":\"deny\"") != null);
    const passed = try testing.respond(arena, sampleHandler, .{ .event = "PreToolUse", .input = "{\"tool_input\":{\"command\":\"ls\"}}" });
    try std.testing.expectEqualStrings("{}", passed.?);
    // A handler that fails sends nothing when open, and a deny when the entry is failClosed.
    const crash = "{\"tool_input\":{\"command\":\"boom\"}}";
    try std.testing.expect((try testing.respond(arena, sampleHandler, .{ .event = "PreToolUse", .input = crash })) == null);
    const closed = try testing.respond(arena, sampleHandler, .{ .event = "PreToolUse", .input = crash, .fail_closed = true });
    try std.testing.expect(std.mem.indexOf(u8, closed.?, "\"deny\"") != null);
    // Input that is not a JSON object is a no-op, without calling the handler.
    try std.testing.expectEqualStrings("{}", (try testing.respond(arena, sampleHandler, .{ .event = "PreToolUse", .input = "nope" })).?);
}
