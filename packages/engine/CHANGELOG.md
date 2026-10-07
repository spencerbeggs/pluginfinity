# @pluginfinity/engine

## 0.3.0

### Breaking Changes

- The hook, server and monitor libraries now share one logging standard and a new hook-output contract. No compatibility shims are provided; migrate each plugin as described.

- Logs are written to `error.log` and `debug.log` with a single line format. `hook-error.log`, `hook-debug.log` and `server-error.log` are no longer written.

- `PLUGINFINITY_DEBUG` is the only debug switch. `PLUGINFINITY_HOOK_DEBUG` is removed.

- `hook_allow` now takes `[reason] [updated-input-json]`.

- `hook_project_dir` follows the tool call's `cwd`. Use `hook_session_dir` for the session's project.

- `hook_project_dir` is never empty: the input's absolute `cwd` resolves to its git root or itself, then `CLAUDE_PROJECT_DIR`, then `$PWD`, and a plugin directory is never walked.

- A source `monitors/monitors.json` fails the build as `PathConflict` (`reserved-monitors-file`) whenever the target builds monitors. Declare monitors in `pluginfinity.config.ts` instead.

- Claude Code script hook entries render as `env K=V... bash <path>` so the event and fail policy reach every entry.

- A hook script path containing `=` fails the build under `scripts.invoke: "exec"`.

- `PLUGINFINITY_MONITOR_MAX_TICKS=0` no longer stops a monitor; it is unbounded, with a log line.

### Features

#### Monitors

- Monitors build from the config's `monitors` component into Claude Code's `monitors/monitors.json`, with the new `lib/pluginfinity/monitor.sh` library. Copilot, which has no monitors, gets a `monitor-omitted` build note. A monitor's `on-skill-invoke:<skill>` is written for Claude as `on-skill-invoke:<plugin>:<skill>`, and a skill the plugin does not build fails the build.

#### Shared logging

- `lib/pluginfinity/log.sh` is shared by hooks, servers, monitors and skill scripts. Servers gain `server_debug`.

#### Server library

- `server_exec_bin`'s fallback uses the project's package manager (from `devEngines.packageManager`, `packageManager` or lockfiles) instead of always `npx`.
- A declared package manager the server library does not know falls through to lockfiles, then npm.

#### Session env

- `env` in the config declares session variables resolved once at SessionStart through the chain default, `setup` script, `.env`, `.env.local`, ambient environment, then `hook_env_set`. A build with `env` writes `lib/pluginfinity/env.sh` and `env-run.sh` and adds a first SessionStart entry that runs the runner (timeout 15 s); a SessionStart reader waits up to 3 s for it, since Claude runs an event's hooks in parallel.
- The hook library sources `env.sh` before every hook body, so every hook sees the values. A skill script or monitor sources `lib/pluginfinity/env.sh` with one line.
- A script or monitor with no session id reads the session `CLAUDE_CODE_SESSION_ID` names when that session has a values file, else the project's latest session, so two Claude Code sessions in one project keep their own values.
- A Copilot event with no `cwd` has no project, so a reader hook reads no `.env` from the plugin root.
- New `hook_env_set NAME value` (producer events and declared names only, always returns 0, appends to `CLAUDE_ENV_FILE` on Claude) and `hook_supports env-shell`.
- An `env.setup` script that is missing or not a file fails the build as `HookScriptInvalid` with component `env`.
- The session env runner (`env-run.sh`) writes nothing to stderr: bash as `sh` no longer prints a job-control notice when the timeout watcher is stopped, so a SessionStart run is silent.

#### Skill directories

- New `{{skill_dir}}` and `{{skill_dir <skill>}}` body tokens: `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PLUGIN_ROOT}/skills/<skill>` on Claude, and the placeholder `<skill base directory>` on Copilot, which expands no path in a body. The bare form in an agent body, and a named skill from a Copilot agent, fail the build.

#### Hook library

- `failClosed` on a hook entry makes a hook crash block instead of fail open.
- New helpers: `hook_require_input`, `hook_envelope`, `hook_relay` and `hook_tool_name` (in `tools.sh`).
- `hook_has` and `hook_tool_prefix` read what the target builds and the server tool prefix from `tools.sh`.
- `monitor_once` keys on `CLAUDE_CODE_SESSION_ID`, then `CLAUDE_SESSION_ID`, then `$PPID`, and every monitor honours `PLUGINFINITY_MONITOR_MAX_TICKS`.
- On Copilot, matchers are enforced at run time for `SessionStart`, `SessionEnd` and `SubagentStop`, which the host ignores.
- New build notes: `hook-matcher-runtime`, `hook-output-ignored` and `monitor-omitted`.
- Copilot reports a fresh session's SessionStart source as `new`, so a SessionStart matcher that holds `startup` is widened to hold `new` as well on a host that ignores the matcher (`hook-matcher-widened`), and a regex matcher that matches `startup` but not `new` is left as written with a `hook-matcher-regex` note.
- New build notes `env-shell-unsupported` (the host passes no session env to the model's shell, so a skill script must source `env.sh`) and `env-wait-timeout` (a SessionStart entry with a `timeout` under 5 s).
- `PLUGINFINITY_MONITOR_MAX_TICKS` must be a positive integer and counts every check, however triggered; anything else, `0` included, is logged once and treated as unbounded.
- New `hook_supports server-project` succeeds on Claude Code and fails on Copilot, answering whether an MCP server can learn the project, so a hook branches on a capability instead of the host.

#### Build

- Per-target files for skills, agents and other copied files.
- `{{tool X | fallback}}` supplies a spelling when a host cannot name the tool.
- ``{{tool `X`}}`` renders the tool name in a code span where the host spells it, and the plain fallback elsewhere. A code span jammed against the kind, ``{{tool`X`}}``, is reported as a token problem.
- `hook_has` lists a skill or agent only on the hosts that build it (`targets: { copilot: false }` is honoured). [#18][#18]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/core | dependency | updated | 0.2.1 | 0.3.0 |
| @pluginfinity/targets | dependency | updated | 0.2.1 | 0.3.0 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#18]: https://github.com/spencerbeggs/pluginfinity/pull/18

## 0.2.1

### Breaking Changes

- `ServerRender.files` no longer holds Claude Code's server files, since a target that places servers in its manifest writes none. `ServerRender.manifest` is added and carries those maps by manifest key, and `renderManifest` takes them as an optional argument.
- `PathConflict` gains a required `conflict` field, `generated`, `reserved-dir` or `reserved-server-file`, and its message and remediation now say which. A source `.mcp.json` or `.lsp.json` is rejected for a Claude build only when that build has inline `mcpServers` or `lspServers`; a plugin without them ships its own file as before.

### Bug Fixes

- `build` writes Claude Code's MCP and LSP servers inline in `plugin.json` rather than to `.mcp.json` and `.lsp.json`, so a `.gitignore` that excludes `.mcp.json` no longer leaves a committed Claude build without its MCP server or makes `build --check` fail on a clean clone.
- A `.mcp.json` or `.lsp.json` an earlier build wrote is deleted by the next `build` and reported as removed by `build --check`; commit the deletion. [#15][#15]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/core | dependency | updated | 0.2.0 | 0.2.1 |
| @pluginfinity/targets | dependency | updated | 0.2.0 | 0.2.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#15]: https://github.com/spencerbeggs/pluginfinity/pull/15

## 0.2.0

### Breaking Changes

- `renderSkill` now returns a `RenderedSkill` (`files`, `notes`) and `renderAgent` a `RenderedAgent` (`file`, `notes`); `MappedFrontmatter` gains `drops`, and `targetHooks` returns `omitted`
- `PlanError` no longer includes `NotImplemented`, and `BuildError` now includes `ShippedFileInvalid`
- `renderSkill` and `renderAgent` now take a required `TokenContext` in place of the optional own-MCP argument
- A malformed token of a known kind, such as an unclosed `{{tool Read`, or a `{{ tool }}`-style template variable, is now a `ComponentInvalid` issue; `\{{` keeps it literal
- `{{tool mcp__<server>__<tool>}}` for a third-party MCP server is a `ComponentInvalid` issue on Copilot
- The `referenceLines` export is removed; links are built by `renderTokens`
- `lib/pluginfinity/` is reserved in every target: a shipped source file there fails with `PathConflict`
- A plugin source file at or under `hooks/lib/pluginfinity/` is reported as a `PathConflict`, because that path is owned by the build
- Every target with hooks, not only Copilot, gains `hooks/lib/pluginfinity/{hook.sh,host.sh}`, and Copilot hook entries gain `env: { PLUGINFINITY_EVENT: <event> }`, so existing builds drift on upgrade; rebuild to refresh them
- `host.sh` stamps the engine version, so every pluginfinity upgrade needs a rebuild, and `pluginfinity build --check` reports the library as drift until then [#13][#13]

### Features

#### MCP and LSP servers

- `build` and `validate` now build `mcpServers` and `lspServers` instead of failing with `NotImplemented`. `renderServers` writes each target's server files through one encoder per MCP and LSP format, rewriting `${PLUGIN_ROOT}` only in the fields the hosts expand it in, and `serverFiles` lists the plugin files the servers name.

- Server files named after `${PLUGIN_ROOT}/` and the entries of the new `files` key ship with each target's build; a named directory ships every file under it, and a reference ends at `:` or `,` as well as at whitespace

- A host root spelling such as `${CLAUDE_PLUGIN_ROOT}`, or a brace-less `$PLUGIN_ROOT`, in a server's root fields is a `ComponentInvalid` issue keyed by the server and field; a server a target override sets is keyed under the target, as `copilot.mcpServers.<name>.args`

- A new `ShippedFileInvalid` build error, with `ShippedFileProblem` (`missing`, `not-executable`, `directory`, `outside-root`, `not-normal`), reports a file that cannot ship

- Targets with a local server get the injected server library at `lib/pluginfinity/server.sh`, and each local server's `env` gains `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB`

#### Build notes

- `build` and `validate` now report what each target dropped, degraded or omitted. Every `TargetBuild` and `TargetValidation` carries `notes`, a sorted list of `BuildNote` (`target`, `path`, `kind`, `name`), with `kind` one of `BUILD_NOTE_KINDS`: `dropped`, `degraded`, `tool-dropped` or `hook-omitted`. `path` is the component's source path, or `config` for hooks and servers. Notes never fail a build, and a value a translation table drops, such as `model: inherit` on Copilot, gets none.

#### A plugin's own MCP tools on Copilot

- An agent `tools` or skill `allowed-tools` name `mcp__plugin_<plugin>_<server>__<tool>`, where `<plugin>` is the plugin's Claude Code name and `<server>` an MCP server the target declares, is now written as `<server>/<tool>` on Copilot instead of being dropped. Claude Code keeps it as written. Another plugin's `mcp__plugin_…` name is still dropped on Copilot, now with a `tool-dropped` note.

#### Body tokens and pluginfinity links

- `renderTokens` rewrites a skill or agent body for one target after host blocks. A `{{tool <name>}}`, `{{agent <name>}}`, `{{skill <name>}}` or `{{plugin_root}}` token is replaced everywhere, code included, with the target's run-time spelling; any other `{{…}}` is text, and `\{{` keeps a token literal. An inline `[text](pluginfinity://skill/<skill>[/<path>][#anchor])` or `[text](pluginfinity://agent/<agent>)` link outside code is built in the target's reference style instead of refused. `SKILL.md`, every other `.md` file in a skill directory and agent bodies are rendered; a token or link a target cannot spell, or any other `pluginfinity://` outside code, is a `ComponentInvalid` on the file, keyed by its source line and naming the target; a stray `pluginfinity://` is quoted within 80 characters either side, and a line with more than three reports the first three and a count of the rest. `renderSkill` fails with a `ComponentsInvalid` when several files of one skill have problems. `TokenContext` and `TokenProblem` are exported. `TokenContext.plugin` is the plugin's name on the target being built, used for agent ids and skill commands, and `own.plugin` the Claude Code name, used for the plugin's own MCP tools and the `{plugin}` of the run-time MCP template. A token or link issue carries `kind: "token"` on its `ConfigIssue`, and `ComponentInvalid` and `ComponentsInvalid` then lead their hint with correcting the listed problems, then offer a host block for another target, the `\{{` escape or inline code instead of a `targets` block.

#### Host-neutral bash hook library

- `pluginfinity build` now injects a bash hook library, `hook.sh`, plus a generated `host.sh` into `hooks/lib/pluginfinity/` of every target that has hooks. Hook scripts can source it to read hook input and emit decisions the same way on Claude Code and GitHub Copilot.

- The library reads Copilot's `tool_input` key names through Claude's names, so one script handles both hosts

- Setting `PLUGINFINITY_HOOK_DEBUG=1` logs the raw hook input and one `outcome:` line per hook exit (block, deny, noop, none, a fail-closed response, plus any non-zero exit code) for debugging

- Copilot hook entries now carry `env: { PLUGINFINITY_EVENT: <event> }` so the library knows which event fired

#### Hook and server library helpers

- `hook_cd_project` changes into `hook_project_dir`, for a hook that runs a project-aware CLI on Copilot, where hooks run from the plugin root
- `server_exec_bin <bin> <package> --install <install-package>` names a different package in the install hint, while `npx` still runs `<package>`

### Bug Fixes

- `planEmit` no longer compares a generated file's mode, and compares a copied file's mode by its executable bit alone, so `build --check` is not stale after a git hook or umask changes other permission bits
- Hook scripts that only another target's hooks run are now left out of a target's build whichever targets a run selects, so `build --check --target copilot` after a full build is clean

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/engine | dependency | updated | ^0.3.0 | ^0.4.0 |
| @effected/yaml | dependency | updated | ^0.19.0 | ^0.19.1 |
| @pluginfinity/core | dependency | updated | 0.1.1 | 0.2.0 |
| @pluginfinity/targets | dependency | updated | 0.1.1 | 0.2.0 |

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
| @pluginfinity/core | dependency | updated | 0.1.0 | 0.1.1 |
| @pluginfinity/targets | dependency | updated | 0.1.0 | 0.1.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#9]: https://github.com/spencerbeggs/pluginfinity/pull/9

## 0.1.0

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

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/core | dependency | updated | 0.0.1 | 0.1.0 |
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
| @pluginfinity/core | dependency | updated | 0.0.0 | 0.0.1 |
| @pluginfinity/targets | dependency | updated | 0.0.0 | 0.0.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!
