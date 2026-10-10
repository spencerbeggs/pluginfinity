# pluginfinity

## 0.3.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/cli | dependency | updated | ^0.15.0 | ^0.16.1 |
| @effected/env | dependency | updated | ^0.1.0 | ^0.1.1 |
| @pluginfinity/cli | dependency | updated | 0.3.1 | 0.3.2 |

[#27][#27]

### Thanks

Thanks to [@spencerbeggs](https://github.com/apps/spencerbeggs) for their contributions!

[#27]: https://github.com/spencerbeggs/pluginfinity/pull/27

## 0.3.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/cli | dependency | updated | ^0.14.0 | ^0.15.0 |
| @pluginfinity/cli | dependency | updated | 0.3.0 | 0.3.1 |

[#22][#22]

### Thanks

Thanks to [@spencerbeggs](https://github.com/apps/spencerbeggs) for their contributions!

[#22]: https://github.com/spencerbeggs/pluginfinity/pull/22

## 0.3.0

### Breaking Changes

- The bats helper follows the new hook contract: `hook_allow` takes `[reason] [updated-input-json]`, and Claude script hook entries run as `env K=V... bash <path>`. Update tests that assert on the old shapes; there is no compatibility shim.
- `run_hook` runs the script with the environment of the built entry that registers it, and fails when no entry runs the script (use `run_script` for an unregistered one). It takes `--matcher` (read from `env.PLUGINFINITY_MATCHER` on Copilot's `SessionStart`, `SessionEnd` and `SubagentStop` entries) and `VAR=value` overrides, and says on stderr when it guesses an entry.
- `run_script` takes `--env VAR=value` (repeatable) in place of a trailing `-- VAR=value...`; a bare `--` and every later argument now reach the script.
- One test project, `$BATS_TEST_TMPDIR/project`, is the default for `hook_fixture`'s `cwd`, `HOOK_PROJECT_DIR` (so `CLAUDE_PROJECT_DIR` for `run_hook` and for skill scripts on Claude), a skill script's directory and `run_monitor`'s. It was `$BATS_TEST_TMPDIR` itself for hooks.
- `run_script` gives a `skills/` script the environment the agent's Bash tool gives one: on Claude Code `CLAUDE_CODE_SESSION_ID=test-session` and no `CLAUDE_PLUGIN_ROOT` or `CLAUDE_PROJECT_DIR` (`HOOK_PROJECT_DIR` no longer reaches it), on Copilot no `PLUGIN_ROOT`. A launcher keeps the plugin variables. Update tests that read the plugin variables in a skill script.
- `run_monitor` for a missing monitor now sets `$status` to 1.
- `run_monitor` is bounded by `--timeout` (default 30 seconds) and exits with status 124 when it runs out, so a test that runs a long `--ticks` count needs a larger `--timeout`. `--timeout 0` is rejected.
- `PLUGINFINITY_MONITOR_MAX_TICKS=0` now means unbounded, not zero ticks, so a test must not rely on it to stop a monitor.

### Features

- `defineConfig` accepts the `monitors` component and `failClosed` on hook entries.
- New bats helpers `run_script` and `run_monitor` run a built skill script or monitor the way the host does.
- `run_script` takes `--cwd` and runs `skills/` paths from the project directory on both hosts.
- `run_script --env-file <file>` adds a file's `NAME=value` or `export NAME=value` lines to a script's environment, parsed and not sourced, to model `CLAUDE_ENV_FILE` exports.
- `run_monitor` starts in the project directory without the plugin variables Claude does not set and with `CLAUDE_CODE_SESSION_ID=test-session`.
- `run_monitor --timeout <seconds>` (default 30) kills the monitor's process group and sets `$status` to 124, so a monitor that never reaches its tick count fails the test instead of hanging bats.
- New `--session-env <file>` on `run_hook`, `run_script` and `run_monitor` seeds the session values a reader sees, as if SessionStart had run, for plugins that declare `env`. On Claude Code a script outside `skills/` is seeded for the project its `CLAUDE_PROJECT_DIR` names.
- `run_hook` writes the env runner's done marker for an unseeded `SessionStart` hook, so it resolves at once instead of waiting 3 s; `--env-wait` keeps the wait.
- `--session-env` and the done marker go under the state dir the script gets: a caller's own `XDG_STATE_HOME` (trailing on `run_hook` and `run_monitor`, `--env` on `run_script`, last one wins), else `$BATS_TEST_TMPDIR/state`.
- `run_hook` reads `--matcher`, `--session-env` and `--env-wait` anywhere in the trailing list, mixed with `VAR=value`; only the exact option words count, so `EXTRA=--matcher` stays a variable.
- `run_script` picks the interpreter by extension (`.mjs`, `.cjs` and `.js` run under `node`, anything else under `bash`) and takes `--interpreter <cmd>` to override it. [#18][#18]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/cli | dependency | updated | 0.2.1 | 0.3.0 |
| @pluginfinity/core | dependency | updated | 0.2.1 | 0.3.0 |
| @pluginfinity/engine | dependency | updated | 0.2.1 | 0.3.0 |
| @pluginfinity/targets | dependency | updated | 0.2.1 | 0.3.0 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#18]: https://github.com/spencerbeggs/pluginfinity/pull/18

## 0.2.1

### Bug Fixes

- `pluginfinity build` now writes a Claude Code plugin's MCP and LSP servers inline in `.claude-plugin/plugin.json` instead of a root `.mcp.json` and `.lsp.json`. Many repositories gitignore `.mcp.json`, so the committed Claude build silently registered no MCP server and `build --check` failed on every clean checkout. The next build deletes the old files; commit the deletion. A source `.mcp.json` or `.lsp.json` that would ship to the Claude build now fails with `PathConflict`; move those servers into `mcpServers` or `lspServers`. Copilot output is unchanged. [#15][#15]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/cli | dependency | updated | 0.2.0 | 0.2.1 |
| @pluginfinity/core | dependency | updated | 0.2.0 | 0.2.1 |
| @pluginfinity/engine | dependency | updated | 0.2.0 | 0.2.1 |
| @pluginfinity/targets | dependency | updated | 0.2.0 | 0.2.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#15]: https://github.com/spencerbeggs/pluginfinity/pull/15

## 0.2.0

### Breaking Changes

- `lib/pluginfinity/` is now reserved like `hooks/lib/pluginfinity/`: a shipped source file there fails the build with `PathConflict`
- A server `env` key starting with `PLUGINFINITY_` now fails as `ConfigInvalid`
- A body that already holds `{{tool …}}`, `{{agent …}}`, `{{skill …}}` or `{{plugin_root}}` text is now rendered as a token; write `\{{` to keep it literal
- A template variable that starts with a token kind, such as `{{ tool }}` or `{{ skill.name }}`, is now read as a token and fails the build; write `\{{` to keep it literal
- A malformed token of a known kind, such as an unclosed `{{tool Read` or `{{agent}}` with no name, now fails the build instead of shipping as text
- `{{tool mcp__<server>__<tool>}}` naming a third-party MCP server fails the Copilot build: Copilot has no run-time name for another server's tools, so put the passage in a Claude Code host block
- A plugin source file at or under `hooks/lib/pluginfinity/` is now reported as a `PathConflict`, because that path is owned by the build
- Every target with hooks gains `hooks/lib/pluginfinity/{hook.sh,host.sh}`, so existing builds drift on upgrade; rebuild to refresh them
- `host.sh` stamps the engine version, so every pluginfinity upgrade needs a rebuild, and `pluginfinity build --check` reports the library as drift until then [#13][#13]

### Features

#### bats helper for testing built hooks

- The package now ships `bats/pluginfinity.bash`, a bats helper for testing a plugin's built hooks. It provides `run_hook`, a set of assert functions and `hook_fixture`, so hook tests can feed fixture input to a built hook and assert on its output and exit status.

#### Host-neutral bash hook library

- `pluginfinity build` now injects a bash hook library, `hook.sh`, plus a generated `host.sh` into `hooks/lib/pluginfinity/` of every target that has hooks. Hook scripts source it to read hook input and emit decisions the same way on Claude Code and GitHub Copilot.

- Setting `PLUGINFINITY_HOOK_DEBUG=1` logs each hook's raw input and one `outcome:` line per hook exit to a plaintext debug log

- Copilot hook entries now carry `env: { PLUGINFINITY_EVENT: <event> }`

#### MCP and LSP servers

- `pluginfinity build` now builds the `mcpServers` a config declares, which used to fail with `NotImplemented`, and a new `lspServers` key, both in Claude Code's server shape. Each target gets its own server files: `.mcp.json` and `.lsp.json` on Claude Code, and `mcp.json` and `com.github.copilot/lsp.json` on GitHub Copilot.

- `${PLUGIN_ROOT}` is rewritten to each host's root variable in a local MCP server's `command`, `args`, `env` values and `cwd`, and in an LSP server's `command`, `args`, `env` values and `workspaceFolder`

- A host's own spelling there, such as `${CLAUDE_PLUGIN_ROOT}`, or a brace-less `$PLUGIN_ROOT`, fails the build instead of shipping nothing; write `${PLUGIN_ROOT}`

- On Copilot every local MCP server is written with `"type": "stdio"`, `http` becomes `streamable-http`, and an LSP server's `extensionToLanguage` is written as `fileExtensions`

- A server under `claude` or `copilot` replaces the base server of the same name on that host

- An MCP `cwd` fails the Claude Code build, because Claude Code ignores it; an LSP `workspaceFolder` or `settings` fails the Copilot build, because Copilot has neither

#### Shipped launchers and files

- Every file a server names after `${PLUGIN_ROOT}/` now ships with that host's build, and a named directory ships every file under it. A reference ends at `:` and `,` too, so `PATH: "${PLUGIN_ROOT}/bin:/usr/bin"` ships `bin/`. A new base `files` key ships extra files and directories to every target. A named path must exist inside the plugin and be written without `.` or `..` segments, and a path used as a whole `command` must be an executable file, not a directory; otherwise the build fails with the new `ShippedFileInvalid` finding.

#### Server library

- Every target with a local MCP or LSP server gets `lib/pluginfinity/server.sh`, a POSIX `sh` library for launcher scripts, and each such server's `env` gains `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB`. A launcher sources `$PLUGINFINITY_LIB/server.sh` and calls `server_exec_bin <bin> <package>` to run the project's installed binary, falling back to `npx`, with no host branches.

#### Build notes

- `pluginfinity build`, `build --check` and `validate` now list, under each target's `✓` line, what that host dropped, degraded or omitted, one line per source file:

```text
✓ copilot: /work/plugins/x/builds/copilot (0 added, 1 changed, 0 removed)
  · agents/x.md: dropped color, maxTurns
  · skills/s/SKILL.md: degraded paths; tool-dropped ToolSearch
  · config: dropped lspServers.md.diagnostics; hook-omitted Setup
```

- Under `--agent` or `--ci`, each build and validation carries a `notes` array of `{ path, kind, name }`. Notes never change the exit code.

#### A plugin's own MCP tools on Copilot

- A skill or agent can now name its own plugin's MCP tools as Claude Code does, `mcp__plugin_<plugin>_<server>__<tool>`, and the Copilot build writes `<server>/<tool>` instead of dropping them.

#### Body tokens and pluginfinity links

- A skill or agent body can name a tool, an agent, a skill or the plugin root once and get each host's spelling:

| Write | Claude Code | Copilot |
| :-- | :-- | :-- |
| `{{tool Read}}` | `Read` | `view` |
| `{{tool mcp__plugin_<plugin>_<server>__<tool>}}` | as written | `<server>-<tool>` |
| `{{agent <agent>}}` | `<plugin>:<agent>` | `<plugin>:<agent>` |
| `{{skill <skill>}}` | `/<plugin>:<skill>` | `/<plugin>:<skill>` |
| `{{plugin_root}}` | `${CLAUDE_PLUGIN_ROOT}` | fails the build |

- In an agent id or skill command `<plugin>` is the plugin's name on that host, so a `copilot.name` override shows on Copilot; in an MCP tool name, as in the `{{tool}}` MCP row, it is the Claude Code name on both hosts. Tokens are replaced everywhere, code included, in `SKILL.md`, every other `.md` file in a skill directory and agent bodies. Only those four kinds are tokens, so GitHub Actions `${{ }}`, Jinja and Handlebars pass through, and `\{{` keeps a token literal. A token a host cannot spell fails the build with its file, line and host, and the finding's hint says to put that passage in a host block or write `\{{`.

- Inline `[text](pluginfinity://skill/<skill>[/<path>][#anchor])` and `[text](pluginfinity://agent/<agent>)` links are now built: a link under `${CLAUDE_PLUGIN_ROOT}` on Claude Code, prose on Copilot. Any other `pluginfinity://` outside code still fails the build.

#### Hook and server library helpers

- `hook_cd_project` in the hook library changes into the user's project before a hook runs a project-aware CLI
- `server_exec_bin` takes `--install <package>` after its two arguments to name a different package in the "not installed" hint

### Bug Fixes

- `build --check` now compares a file's content and, for a file copied from the source, only its executable bit, so a generated file turned executable by a git hook, or a copied file whose other permission bits differ, no longer reports `BuildStale`; a copied file whose executable bit differs from its source still does
- A hook script only one target runs no longer ships to another target when a run builds that target alone, so `build --check --target <id>` agrees with a full build

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effect/platform-node | dependency | updated | ^4.0.0 | ^4.0.1 |
| @effected/cli | dependency | updated | ^0.11.0 | ^0.13.0 |
| @effected/engine | dependency | updated | ^0.3.0 | ^0.4.0 |
| @pluginfinity/cli | dependency | updated | 0.1.1 | 0.2.0 |
| @pluginfinity/core | dependency | updated | 0.1.1 | 0.2.0 |
| @pluginfinity/engine | dependency | updated | 0.1.1 | 0.2.0 |
| @pluginfinity/targets | dependency | updated | 0.1.1 | 0.2.0 |
| effect | dependency | updated | ^4.0.0 | ^4.0.1 |

[#13][#13]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#13]: https://github.com/spencerbeggs/pluginfinity/pull/13

## 0.1.1

### Bug Fixes

- On Copilot, agent and skill tool lists drop names Copilot has no tool for: Claude-only tools such as `ToolSearch`, `SendMessage` and the `Task` tools, and another plugin's `mcp__plugin_...` MCP tools. Previously they were passed through. Claude Code keeps every name.
- Claude Code hook scripts are written in exec form, `"command": "bash"` with the script path in `args`, so no shell ever parses the path. A `command` entry is still written as the shell string you gave.
- The companion plugin's `pluginfinity` skill describes both changes. [#9][#9]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/cli | dependency | updated | 0.1.0 | 0.1.1 |
| @pluginfinity/core | dependency | updated | 0.1.0 | 0.1.1 |
| @pluginfinity/engine | dependency | updated | 0.1.0 | 0.1.1 |
| @pluginfinity/targets | dependency | updated | 0.1.0 | 0.1.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#9]: https://github.com/spencerbeggs/pluginfinity/pull/9

## 0.1.0

### Breaking Changes

- `pluginfinity.config.ts` now requires a non-empty `description`

### Features

#### `pluginfinity build`

- `build` turns one plugin source into `builds/claude/` and `builds/copilot/`:

- **Manifests.** Each host's manifest is written from the config, with its version from the `package.json` beside it. Claude Code gets `.claude-plugin/plugin.json`; Copilot gets an Agent Plugins 1.0 `plugin.json`.

- **Skills.** Every `skills/<name>/SKILL.md` is decoded strictly in Claude Code's field names. Each host's copy has its own frontmatter; on Copilot, `when_to_use` and `paths` fold into `description`. Support files ship too.

- **Agents.** Every `agents/<name>.md` is written to each host's agents directory. On Copilot, tools become its aliases, models and effort levels are translated, and `skills` becomes a section of the body.

- **Hooks.** Hooks declared in the config are written to each host's hooks file. Each target ships the `hooks/` directory along with every script and file a command names.

- **`targets` blocks.** A skill or agent can set fields for one host, or leave that host out.

- **Host blocks.** `<!-- pluginfinity:only <id> -->` blocks keep a passage for the listed hosts only.

- **Careful rewrites.** A build writes only the files that differ and removes files no longer produced. Unchanged files keep their mtimes.

#### `build --check` and `validate`

- `build --check` writes nothing and fails with `BuildStale` when `builds/` is out of date, naming every file. `validate` needs current builds, then runs `claude plugin validate` on the Claude Code build and checks that Copilot loads the Copilot build under the manifest's name and version.

#### Findings

- A problem is a finding with a message and a fix hint: exit 1, or one JSON object for agents and CI. Every skill and agent problem in a plugin is reported in a single run.

- YAML that Claude Code reads more leniently than other hosts is refused rather than shipped. That covers a plain value holding ` :  ` or `  # `.

- A `pluginfinity://` link fails until references are built, and so does a config that sets `mcpServers`. [#5][#5]

* The config accepts `author`, `homepage`, `repository`, `license` and `keywords` for the generated manifests
* `hooks` declares hooks once, keyed by Claude Code event names, with `script` or `command` entries; `claude` and `copilot` can override them per event
* `mcpServers` takes MCP servers in Claude Code's `.mcp.json` shape, with per-target overrides; they are not built yet, so a config that sets them fails with `NotImplemented`
* `scripts.invoke` chooses whether `script` hooks run through `bash` (the default) or directly
* The `claude` and `copilot` targets are described as data, ready for the build pipeline [#5][#5]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/cli | dependency | updated | 0.0.1 | 0.1.0 |
| @pluginfinity/core | dependency | updated | 0.0.1 | 0.1.0 |
| @pluginfinity/engine | dependency | updated | 0.0.1 | 0.1.0 |
| @pluginfinity/targets | dependency | updated | 0.0.1 | 0.1.0 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#5]: https://github.com/spencerbeggs/pluginfinity/pull/5

## 0.0.1

### Features

- First published release, made to claim the package names. pluginfinity is under development: these packages install and run, but they do not build plugins yet.

- `pluginfinity doctor` checks Node.js, the package manager, the targeted host CLIs, bats, git and whether the config loads, with `--strict` for use as a CI gate

- `pluginfinity build`, `validate`, `init` and `plugin add` parse and check their input, then stop with "not implemented yet"

- `defineConfig` types a `pluginfinity.config.ts`, with `claude` and `copilot` as top-level target keys

- The `@pluginfinity/*` packages are internal layers of the `pluginfinity` package and are not a supported API

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/cli | dependency | updated | 0.0.0 | 0.0.1 |
| @pluginfinity/core | dependency | updated | 0.0.0 | 0.0.1 |
| @pluginfinity/engine | dependency | updated | 0.0.0 | 0.0.1 |
| @pluginfinity/targets | dependency | updated | 0.0.0 | 0.0.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!
