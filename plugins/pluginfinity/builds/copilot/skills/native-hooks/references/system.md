# Outside the event

A hook that only reads its input and answers needs none of this. Read it when a native hook runs another program, keeps a file between runs, or needs to know where it is. The bash side of the same concerns is the `bash-hooks` skill's [scripts outside hooks](../../bash-hooks/references/scripts.md).

## What stays bash

The library builds hooks and nothing else. `hook.run` reads one event and sends one answer, so these parts of a plugin are still shell scripts:

- **A server launcher.** It sources the server library, which finds the project and the package manager.
- **A script a skill tells the model to run.**
- **A monitor.**

Write those with the `bash-hooks` skill's scripts reference. A plugin can hold native hooks beside them.

## Where the hook is

| You need | Use |
| :-- | :-- |
| The user's project, for this call | `h.projectDir()`. Never empty |
| The session's project, which differs in a git worktree | `h.sessionDir()` |
| The plugin's own files | `h.getenv("PLUGINFINITY_ROOT")`, which the entry sets to the build root |
| The plugin's data directory | `h.dataDir()` |

- **The working directory is not the project on Copilot,** which runs hooks from the plugin root. Build every path from `h.projectDir()`. `h.exec` already runs there.
- **Never find the user's project from the binary's own path.** An installed plugin lives in a cache.

## Running another program

`h.exec` runs a program in the project, waits, and captures what it prints, so nothing but the answer reaches stdout.

```zig
const status = try h.exec(&.{ "git", "status", "--porcelain" });
if (!status.ok()) return h.noop();
const dirty = status.text().len > 0;
```

- **A non-zero exit is not an error.** `try` fails only when the program cannot start. Check `ok()` or `code`.
- **There is no shell:** no pipes, globs or `$VAR`. Do the work in Zig, or run `sh -c` when you must.
- **Output is capped at 1 MiB** for each of stdout and stderr.
- **`h.exec` and `h.execWith` do nothing in a unit test** and return `error.NoIo`. Put what you do with the result in a plain function and test that.

### Credentials

Tools such as `gh`, `aws` and `kubectl` read their own environment variables before their keyring, profile or context. A stale `GH_TOKEN` in the user's shell beats a good `gh auth login`, and the hook never notices.

`h.exec` passes the hook's environment on unchanged. `h.execWith` changes it for the one program: the names in `unset` are removed, then the pairs in `set` are added.

```zig
/// Run `gh` with the plugin's own token and nothing inherited.
fn gh(h: *hook.Hook, args: []const []const u8) !hook.Exec {
    var argv: std.ArrayList([]const u8) = .empty;
    try argv.append(h.arena, "gh");
    try argv.appendSlice(h.arena, args);
    if (h.getenv("MYPLUGIN_GH_TOKEN")) |token| {
        return h.execWith(argv.items, .{
            .unset = &.{ "GH_HOST", "GH_REPO", "GITHUB_TOKEN" },
            .set = &.{ .{ "GH_TOKEN", token }, .{ "GH_PAGER", "cat" } },
        });
    }
    // An empty GH_TOKEN counts as a token, so remove it and let gh use the keyring.
    return h.execWith(argv.items, .{
        .unset = &.{ "GH_HOST", "GH_REPO", "GH_TOKEN", "GITHUB_TOKEN" },
        .set = &.{.{ "GH_PAGER", "cat" }},
    });
}
```

```zig
const pr = try gh(h, &.{ "pr", "view", "--json", "state" });
if (!pr.ok()) return h.noop();
```

- **Namespace the plugin's own variable** (`MYPLUGIN_GH_TOKEN`) and translate it for the one call. Never tell the user to export `GH_TOKEN`.
- **Make every `gh` call through the one function,** the check and the use alike. A probe that scrubs while the write call does not passes against the keyring, then writes with the stale token.
- **Scrub `GH_HOST` and `GH_REPO` too,** and pass `--repo` when the hook means a specific one.
- **Pass `--context` to `kubectl` and `helm`, and `--profile` to `aws`,** whenever the hook assumes a cluster or account.
- **A name in both lists ends up set,** and unsetting a name the hook does not have is harmless.
- **The program is found on the hook's own `PATH`,** whatever `set` and `unset` hold.

## State

A hook that remembers something between runs, such as how often it has reminded the agent, writes it under the plugin's data directory.

```zig
const dir = h.dataDir() orelse return error.NoDataDir;
const file = try std.fs.path.join(h.arena, &.{ dir, "reminders", h.input("session_id") orelse "none" });
const seen = if (h.readFile(file)) |text| std.fmt.parseInt(u32, std.mem.trim(u8, text, " \n"), 10) catch 0 else 0;
try h.writeFile(file, try std.fmt.allocPrint(h.arena, "{d}\n", .{seen + 1}));
```

- **`h.dataDir()` is the host's data directory:** `CLAUDE_PLUGIN_DATA` on Claude Code, `COPILOT_PLUGIN_DATA` on Copilot. Outside a host it is `data` under the plugin's state directory, beside its logs.
- **`h.writeFile` replaces the file whole,** creating the directories above it. It writes beside the file and moves the result into place, so another hook never reads half of it.
- **Two hooks that read, change and write the same file can still lose an update.** Keep one file per hook, or per session, when that matters.
- **Never write under the plugin root.** It is the install directory, and it is replaced on every update.
- **Key per-session state on `session_id`,** and on Claude Code key per-agent state on `agent_id`: a subagent's hooks reuse the parent's session id.
- **A value decided once per session is session env, not a file of your own.** Declare it under `env` in the config, read it with `h.env("NAME")`, and set it with `h.envSet` from `SessionStart`. The `pluginfinity` skill's session env (the `pluginfinity` skill's `references/session-env.md`) reference has the whole contract.
- **Neither call does anything in a unit test:** `writeFile` returns `error.NoIo` and `dataDir` null. Test the arithmetic in a plain function.

## Logging

`h.log` and `h.debug` write to the same `error.log` and `debug.log` as every bash script in the plugin, with the component `hook`, so `pluginfinity logs` shows a plugin's bash and native hooks together. The files, the line format and the one debug switch are in the `pluginfinity` skill's logging (the `pluginfinity` skill's `references/logging.md`) reference.
