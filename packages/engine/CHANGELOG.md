# @pluginfinity/engine

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
