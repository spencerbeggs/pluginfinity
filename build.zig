//! pluginfinity-hooks: write agent-plugin hooks as small native programs.
//!
//! As a dependency this file gives a plugin's `build.zig` one call,
//! `addHooks`, which builds every hook for every platform and names each file
//! the way `pluginfinity build` expects a `binary` hook entry's files.

const std = @import("std");

pub const Platform = struct {
    query: std.Target.Query,
    /// What `uname -s`-`uname -m` prints on the platform.
    suffix: []const u8,
};

/// The platforms a hook is built for. The suffix is the lookup key at run
/// time, so a hook entry needs no table to find its binary.
pub const platforms = [_]Platform{
    .{ .query = .{ .cpu_arch = .aarch64, .os_tag = .macos }, .suffix = "Darwin-arm64" },
    .{ .query = .{ .cpu_arch = .x86_64, .os_tag = .macos }, .suffix = "Darwin-x86_64" },
    .{ .query = .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .musl }, .suffix = "Linux-x86_64" },
    .{ .query = .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .musl }, .suffix = "Linux-aarch64" },
    // Git Bash, which the hook entry needs on Windows, reports x86_64; the file gets `.exe`.
    .{ .query = .{ .cpu_arch = .x86_64, .os_tag = .windows }, .suffix = "Windows-x86_64" },
};

pub const Options = struct {
    /// One hook per name, each a program at `<source_dir>/<name>.zig`.
    names: []const []const u8,
    /// Where the hook sources live, relative to the plugin root. Not `hooks`:
    /// pluginfinity ships every file under `hooks/`, sources included.
    source_dir: []const u8 = "native",
    /// This package's name in the plugin's `build.zig.zon`.
    dependency: []const u8 = "pluginfinity_hooks",
    /// How the hook's own source and the library are compiled. `ReleaseSafe`
    /// keeps Zig's safety checks in both, so a bug such as an out-of-bounds index
    /// panics and the library applies the entry's fail policy. The standard
    /// library is always size-optimized, through the entry shim, so this costs
    /// almost nothing in size. `ReleaseSmall` drops the checks: the same bug is
    /// then undefined behaviour, and a `failClosed` guard can let a call through.
    optimize: std.builtin.OptimizeMode = .ReleaseSafe,
    /// Whether the hooks can apply a regular-expression matcher. Copilot ignores
    /// the matcher on SessionStart, SessionEnd and SubagentStop, so the library
    /// applies it; an exact list such as `startup|resume` always works. With
    /// this on, a regular expression does too, at about 165 KB per binary and
    /// one more package to fetch. With it off, such a hook runs for every value
    /// and says so in the error log.
    regex: bool = false,
};

// The library's sources, wherever this package's files are: the dependency's
// root when a plugin builds hooks, this directory when the library builds itself.
const Sources = struct {
    hook: std.Build.LazyPath,
    /// The root of every hook executable; see zig/src/entry.zig.
    entry: std.Build.LazyPath,
    regex_off: std.Build.LazyPath,
    regex_on: std.Build.LazyPath,
    /// The regex engine's root file, when regular-expression matchers are on.
    engine: ?std.Build.LazyPath,
};

// The `hook` module for one target. Its `matcher_regex` import is the real
// engine when a plugin opted in, and a stub that declines every pattern otherwise.
fn hookModule(
    b: *std.Build,
    sources: Sources,
    target: std.Build.ResolvedTarget,
    optimize: ?std.builtin.OptimizeMode,
) *std.Build.Module {
    const matcher = if (sources.engine) |engine|
        b.createModule(.{
            .root_source_file = sources.regex_on,
            .target = target,
            .optimize = optimize,
            .imports = &.{.{
                .name = "regex",
                .module = b.createModule(.{ .root_source_file = engine, .target = target, .optimize = optimize }),
            }},
        })
    else
        b.createModule(.{ .root_source_file = sources.regex_off, .target = target, .optimize = optimize });
    return b.createModule(.{
        .root_source_file = sources.hook,
        .target = target,
        .optimize = optimize,
        .imports = &.{.{ .name = "matcher_regex", .module = matcher }},
    });
}

// One hook executable: the entry shim as its size-optimized root, with the hook's
// own source and the library as modules in `optimize`, sharing one library instance.
fn hookExecutable(
    b: *std.Build,
    sources: Sources,
    name: []const u8,
    source: std.Build.LazyPath,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
) *std.Build.Step.Compile {
    const library = hookModule(b, sources, target, optimize);
    const user = b.createModule(.{
        .root_source_file = source,
        .target = target,
        .optimize = optimize,
        .imports = &.{.{ .name = "hook", .module = library }},
    });
    return b.addExecutable(.{
        .name = name,
        .root_module = b.createModule(.{
            .root_source_file = sources.entry,
            .target = target,
            .optimize = .ReleaseSmall,
            .strip = true,
            .single_threaded = true,
            // Nothing unwinds: a panic goes to the library's handler, which exits.
            .unwind_tables = .none,
            .imports = &.{ .{ .name = "hook", .module = library }, .{ .name = "user", .module = user } },
        }),
    });
}

/// Build every named hook for every platform as `<name>-<os>-<arch>`, and add
/// a `test` step that runs each hook's tests on this machine.
///
/// Run `zig build -p hooks` in the plugin root to put the binaries in
/// `hooks/bin/`, where a `binary: "hooks/bin/<name>"` entry finds them.
pub fn addHooks(b: *std.Build, options: Options) void {
    const dep = b.dependency(options.dependency, .{});
    // The engine is fetched only by a plugin that asks for it. A first build
    // returns here while Zig fetches it, then runs again.
    const engine: ?std.Build.LazyPath = if (options.regex)
        (dep.builder.lazyDependency("regex", .{}) orelse return).path("src/regex.zig")
    else
        null;
    const sources: Sources = .{
        .hook = dep.path("zig/src/hook.zig"),
        .entry = dep.path("zig/src/entry.zig"),
        .regex_off = dep.path("zig/src/regex_off.zig"),
        .regex_on = dep.path("zig/src/regex_on.zig"),
        .engine = engine,
    };
    const test_step = b.step("test", "Run the hooks' unit tests");

    for (options.names) |name| {
        const source = b.path(b.fmt("{s}/{s}.zig", .{ options.source_dir, name }));

        for (platforms) |platform| {
            const target = b.resolveTargetQuery(platform.query);
            const exe_name = b.fmt("{s}-{s}", .{ name, platform.suffix });
            b.installArtifact(hookExecutable(b, sources, exe_name, source, target, options.optimize));
        }

        const tests = b.addTest(.{
            .root_module = b.createModule(.{
                .root_source_file = source,
                .target = b.graph.host,
                .imports = &.{.{ .name = "hook", .module = hookModule(b, sources, b.graph.host, null) }},
            }),
        });
        test_step.dependOn(&b.addRunArtifact(tests).step);
    }
}

pub fn build(b: *std.Build) void {
    const host = b.graph.host;
    var sources: Sources = .{
        .hook = b.path("zig/src/hook.zig"),
        .entry = b.path("zig/src/entry.zig"),
        .regex_off = b.path("zig/src/regex_off.zig"),
        .regex_on = b.path("zig/src/regex_on.zig"),
        .engine = null,
    };

    // For a plugin that writes its own build: `dependency(...).module("hook")`.
    const exported = b.addModule("hook", .{ .root_source_file = sources.hook });
    exported.addImport("matcher_regex", b.createModule(.{ .root_source_file = sources.regex_off }));

    const test_step = b.step("test", "Run the library's unit tests");
    test_step.dependOn(&b.addRunArtifact(b.addTest(.{ .root_module = hookModule(b, sources, host, null) })).step);

    // Working on the library itself: `zig build -Ddev test` also tests the
    // regular-expression matcher, and `zig build -Ddev -p <dir>` installs the
    // test hook both ways. Off by default so that a plugin depending on this
    // package never fetches the regex engine unless it opts in through `addHooks`.
    if (!(b.option(bool, "dev", "Build the test hook and test regular-expression matchers") orelse false)) return;
    const engine = (b.lazyDependency("regex", .{}) orelse return).path("src/regex.zig");

    // The test hook, built exactly as `addHooks` builds a plugin's hooks.
    const responder_source = b.path("zig/test/responder.zig");
    b.installArtifact(hookExecutable(b, sources, "responder", responder_source, host, .ReleaseSafe));
    sources.engine = engine;
    b.installArtifact(hookExecutable(b, sources, "responder-regex", responder_source, host, .ReleaseSafe));
    test_step.dependOn(&b.addRunArtifact(b.addTest(.{ .root_module = hookModule(b, sources, host, null) })).step);
    test_step.dependOn(&b.addRunArtifact(b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = sources.regex_on,
            .target = host,
            .imports = &.{.{ .name = "regex", .module = b.createModule(.{ .root_source_file = engine, .target = host }) }},
        }),
    })).step);
}
