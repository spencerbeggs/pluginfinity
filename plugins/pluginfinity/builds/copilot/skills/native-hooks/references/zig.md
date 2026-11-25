# Zig 0.17 for hook authors

The hook library needs Zig 0.17.1. Zig's standard library changed a great deal on the way there, and most Zig in the wild is older. Code written from memory of an earlier release fails to compile, usually with `no member named ...`. Every snippet here compiles on 0.17.1.

When in doubt, write the smallest thing and run `zig build test`: the compiler names the missing member, and this page names its replacement.

## What moved

| Older Zig | Zig 0.17, in a hook |
| :-- | :-- |
| `pub fn main() !void` | `pub fn main(init: std.process.Init) void { hook.run(init, handle); }` |
| `std.heap.GeneralPurposeAllocator`, `std.heap.page_allocator` | `h.arena`. Nothing needs freeing: the process exits when the handler returns |
| `std.ArrayList(T).init(allocator)`, `list.append(x)` | `var list: std.ArrayList(T) = .empty;` then `try list.append(h.arena, x)`. The allocator is passed to each call |
| `std.io.getStdOut()`, `std.debug.print` for output | Never write stdout in a hook. Respond with `h.deny`, `h.context` and the rest; log with `h.log` |
| `std.io.getStdIn()` | `h.input("a.b")`, `h.as(T)`. The library has already read stdin |
| `std.fs.cwd()`, `std.fs.openFileAbsolute` | `h.exists(path)`, `h.readFile(path)`. The file API now takes an `io` handle on every call |
| `std.process.getEnvVarOwned`, `std.posix.getenv` | `h.getenv("NAME")`, or `h.env("NAME")` for a declared session variable |
| `std.process.Child.run`, `std.ChildProcess` | `try h.exec(&.{ "git", "status" })` |
| `std.mem.trimLeft`, `std.mem.trimRight` | `std.mem.trimStart`, `std.mem.trimEnd`. `std.mem.trim` is unchanged |
| `std.json.stringify(value, .{}, writer)` | `try std.json.Stringify.valueAlloc(h.arena, value, .{})`. In a hook, prefer `h.raw(.claude, value)` |

The library wraps files, processes and the environment on purpose: those are the parts of the standard library that change most between releases. If you need the raw API, the handle is `h.io.?`.

## What Zig refuses

These are compile errors, not warnings:

- **An unused constant or parameter.** Delete it, or discard it with `_ = name;`.
- **A `var` that is never changed.** Write `const`.
- **A name that shadows another**, such as a parameter called `input` inside a struct with an `input` method. Rename it.
- **An ignored error or value.** `try` it, `catch` it, or discard with `_ =`.
- **A format string that is not a literal.** `h.log(message, .{})` fails; write `h.log("{s}", .{message})`.

## Strings

A string is `[]const u8`. There is no `==` for strings.

```zig
std.mem.eql(u8, a, b)                      // equal
std.ascii.eqlIgnoreCase(a, b)              // equal, ignoring ASCII case
std.mem.indexOf(u8, text, "push") != null  // contains
std.mem.startsWith(u8, text, "release/")
std.mem.endsWith(u8, path, ".ts")
std.mem.trim(u8, text, " \n")              // both ends; trimStart and trimEnd for one
```

Build a string with the arena:

```zig
const message = try std.fmt.allocPrint(h.arena, "{s} has {d} items", .{ name, count });
const joined = try std.mem.join(h.arena, ", ", list.items);
const swapped = try std.mem.replaceOwned(u8, h.arena, text, "-", "_");
```

Format specifiers: `{s}` for a string, `{d}` for a number, `{}` for a bool, `{?d}` and `{?s}` for an optional. A string printed with `{}` is a compile error; use `{s}`.

Split and walk:

```zig
var lines = std.mem.splitScalar(u8, text, '\n');     // keeps empty pieces
while (lines.next()) |line| { ... }

var words = std.mem.tokenizeAny(u8, text, " \t");    // skips empty pieces
while (words.next()) |word| { ... }
```

Parse a number: `try std.fmt.parseInt(u32, text, 10)`.

## Optionals and errors

```zig
const command = h.input("tool_input.command") orelse return h.noop();   // absent: let it through

if (h.input("stop_hook_active")) |active| { ... }                       // present: use it

const git = h.exec(&.{ "git", "branch", "--show-current" }) catch |err| {
    h.log("could not run git: {s}", .{@errorName(err)});
    return h.noop();
};
```

- `?T` is an optional: unwrap with `orelse`, `if (x) |v|`, or `.?` when it cannot be null.
- `!T` is an error union: `try` passes the error up, `catch` handles it.
- An error needs no declaration: `return error.MissingPath;` or `orelse return error.MissingPath` creates it. Returning one from the handler is how a hook fails.
- A handler is `fn handle(h: *hook.Hook) !void`. `return h.deny(reason);` works because the helper's own `!void` is what the handler returns. After a helper that returns plain `void`, such as `h.noop()`, just fall off the end or `return`.

## Lists and paths

```zig
var found: std.ArrayList([]const u8) = .empty;
try found.append(h.arena, "one");
for (found.items) |item| { ... }

const path = try std.fs.path.join(h.arena, &.{ h.projectDir(), "src", "a.ts" });
std.fs.path.basename(path)     // "a.ts"
std.fs.path.dirname(path)      // ?[]const u8
std.fs.path.extension(path)    // ".ts"
std.fs.path.isAbsolute(path)
```

`&.{ a, b }` is how a list of values is written inline, as in `h.exec(&.{ "git", "status" })`.

## JSON

The event is already parsed. Reach for these only for JSON of your own, such as a file or a CLI's output:

```zig
const Config = struct { name: []const u8, level: ?f64 = null };
const config = try std.json.parseFromSliceLeaky(Config, h.arena, bytes, .{ .ignore_unknown_fields = true });

const value = try std.json.parseFromSliceLeaky(std.json.Value, h.arena, bytes, .{});
const name = value.object.get("name");     // ?std.json.Value

const text = try std.json.Stringify.valueAlloc(h.arena, .{ .ok = true, .name = "x" }, .{});
```

A field with a default (`= null`) may be absent; one without is required. A number is `f64`.

## Tests

```zig
test "what it proves" {
    try std.testing.expect(condition);
    try std.testing.expectEqualStrings("expected", actual);
    try std.testing.expectEqual(@as(usize, 2), count);
}
```

A test that allocates uses its own arena, as the recipes do:

```zig
var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
defer arena.deinit();
```

`zig build test` prints nothing when every test passes. Add `--summary all` to see the count.
