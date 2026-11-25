# @pluginfinity/ai-plugins

## 0.3.0

### Breaking Changes

#### `hook-authoring` is now `bash-hooks`, and `plugin-scripts` and `migrating-hooks` are removed

- The `hook-authoring` skill is renamed `bash-hooks` and reoriented as the companion to `native-hooks`: one covers a hook written as a bash script, the other a compiled one. Both point to `hook-events`, which now holds the contract they share and names each answer with its bash and native spelling.

- The `plugin-scripts` skill is folded into `bash-hooks` as its `references/scripts.md`, and `native-hooks` gains a matching `references/system.md` for a compiled hook that runs another CLI or keeps state.

- The `migrating-hooks` skill is removed. It converted plugin-bot-era hooks to the hook library.

- To migrate, replace `/pluginfinity:hook-authoring` with `/pluginfinity:bash-hooks` wherever a prompt, agent or skill names it, replace `/pluginfinity:plugin-scripts` with `/pluginfinity:bash-hooks`, and drop any reference to `/pluginfinity:migrating-hooks`.

#### Native hooks: a clean environment for a CLI, and state

- The Zig hook library gains three calls, documented in the `native-hooks` skill:

- `h.execWith(argv, .{ .unset = …, .set = … })` runs a program with variables removed from, and added to, the hook's environment, so a stale `GH_TOKEN` in the user's shell cannot reach `gh`. It needs no shell and works on Windows.

- `h.writeFile(path, bytes)` writes a file whole, creating its directories.

- `h.dataDir()` is the plugin's data directory on the host.

### Features

#### Native hooks skill

- A new `native-hooks` skill covers writing a hook as a compiled Zig program: setup, the write, test and build loop, the rules a native hook must keep, and a troubleshooting table. Its references hold the library's API, the Zig 0.17 spellings that differ from older Zig, and five tested recipes.

#### Hook event schemas

- The `hook-events` skill now ships a JSON Schema for the input and output of every Claude Code hook event, and for each built-in tool's `tool_input`, under `references/schemas/`. Each field carries a description, and a field Claude Code discards on an event is absent from that event's output schema.

#### Skill authoring, agent authoring and persuasion skills

- Three skills return from plugin-bot, rewritten for pluginfinity:

- `skill-authoring` covers writing a `SKILL.md`: the name and description rules, how a skill is triggered on each host, what belongs in the body and what in a reference, and what the Copilot build does with each field. It absorbs the old `skill-evals` skill as a reference on trigger and output evals, with a `trigger-harness.sh` script that runs a query set against Claude Code and reports how often the skill fired.

- `agent-authoring` covers writing `agents/<name>.md`: the description, the tools list, the skills preload, the system prompt and its boundaries section, the fields a plugin agent cannot use, and what the Copilot build keeps, translates or drops.

- `persuasion` covers the wording of text meant to change what an agent does: how much force to use, XML tags for text a hook injects, what each hook event can deliver on each host, and templates for `SessionStart`, `PreToolUse` and `PostToolUse`.

- The `plugin-engineer` agent now preloads `persuasion`, and is told to read it on Copilot.

### Documentation

- The hooks reference covers `binary`, `http`, `mcpTool`, `prompt` and `agent` entries, the `if`, `statusMessage`, `async`, `asyncRewake` and `shell` fields, and `hook_rewake`.
- The event table adds `PreSkillShellCommand`, `PreModelSwitch`, `TaskCompleted`, `TeammateIdle` and the elicitation events, and corrects where `hook_system_message` is honoured.
- The `pluginfinity` skill gains a Hooks section covering the handler kinds and a table routing to the six skills beside it. Its hooks reference documents how a `binary` entry is written and shipped and the `facts.json` a native hook reads, and its targets reference gains a per-host hooks table.
- The `pluginfinity` skill's hooks reference now holds the config only. The bash hook library and the bats helper moved to the `bash-hooks` skill as `references/library.md` and `references/testing.md`, beside the native library's `references/api.md` in `native-hooks`.
- The `pluginfinity` skill gains `references/servers.md` and `references/logging.md`, and session env's testing and migrating sections become pages of their own. Session env now documents `h.env` and `h.envSet` for a native hook.
- The `plugin-engineer` agent gains a loop for native hooks, and the `hook-events` per-event notes no longer assume a bash hook.
- The findings reference adds the `hook-field-dropped` and `hook-matcher-native-regex` notes.

## 0.2.2

### Documentation

- Hook, plugin-scripts and migration skills and the plugin-engineer agent cover the new logging standard, `PLUGINFINITY_DEBUG`, the `hook_allow` reason argument and `hook_project_dir` semantics.
- New `session-env` reference and updated skills teach the `env` block, the precedence chain, `hook_env_set`, `hook_supports env-shell`, the setup script contract, the SessionStart wait and `env-wait-timeout`, sourcing `env.sh` from skill scripts and monitors, and a migration recipe from a hand-rolled per-session env.
- The skills teach `{{skill_dir}}`, the SessionStart `startup` to `startup|new` widening and its notes, `pluginfinity logs`, the four new build notes, `--session-env`, `--env-file`, `run_script` interpreters and the Claude skill-script environment (Copilot's is not measured and assumed minimal), `run_monitor --timeout`, the tick contract for event-driven monitors, and indented host-block markers inside list items.
- The plugin-engineer agent applies session env, `{{skill_dir}}` and the new helpers.
- The session-env migration recipe gives a name its readers detect when empty `default: ""` and leaves per-command overrides undeclared.
- New monitors reference, plus updated config, targets and findings references.
- The skills document `hook_has`, `hook_tool_prefix`, the code-span tool token, `run_hook`, `run_script` and `run_monitor`, the `PLUGINFINITY_MONITOR_MAX_TICKS` contract, both monitor command shapes, and the unknown-manager fall-through.
- The skills build the `env.sh` path from an absolute directory before any `cd` (the one-line form broke after a `cd` from a relative `$0`), show the shellcheck `source` directive and the manual `_pf_env_manual=1` form, and document `hook_supports server-project` beside `server_project_dir`.
- The `run_hook` reference says its options may stand anywhere among the `VAR=value` arguments. [#18][#18]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#18]: https://github.com/spencerbeggs/pluginfinity/pull/18

## 0.2.1

### Documentation

- The `pluginfinity` skill's host table and findings now say Claude Code's servers go inline in `plugin.json`, why a gitignored `.mcp.json` no longer matters, and that a build deletes the `.mcp.json` and `.lsp.json` an older pluginfinity wrote. [#15][#15]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#15]: https://github.com/spencerbeggs/pluginfinity/pull/15

## 0.2.0

### Features

#### plugin-engineer agent

- A new `plugin-engineer` agent for writing, testing and migrating hooks and plugin scripts in a pluginfinity plugin. It works bats-first against both the Claude Code and GitHub Copilot builds, and can convert a plugin-bot-era plugin (vendored `hooks/lib`, `emit_*` calls, hand-written `hooks.json`) to the build-injected hook library.

#### Hook and script skills

- `hook-authoring` walks the bats-first loop for adding a hook, with tested recipes
- `hook-events` explains what each hook event can do on each host, the input it sends and the measured host differences
- `plugin-scripts` covers finding the plugin root and data directory, calling CLIs without leaking credentials, and persistent state
- `migrating-hooks` inventories an old plugin and maps every old helper to the hook library

### Documentation

- The pluginfinity skill's `references/hooks.md` now teaches the build-injected hook library, including Copilot `tool_input` aliasing and raw-input debugging
- The same reference now covers the bats helper for testing built hooks
- The pluginfinity skill and its config, targets and findings references now cover MCP and LSP servers, shipped `files`, and the per-host server rules
- `plugin-scripts` now teaches server launchers on the build-injected server library, including `server_exec_bin --install`
- The pluginfinity skill and its references now explain build notes, how a skill or agent names its own MCP tools, running pluginfinity from the repository root, keeping formatters and commit hooks off `builds/`, mirroring the version after `changeset version`, and that `plugin add` is a stub
- `hook-authoring` and the hooks reference now cover `hook_cd_project`, branching on `hook_supports` for a capability one host lacks, the hook library's runtime commands, `hook_event_name` in test fixtures, and loading the bats helper from a monorepo root
- The pluginfinity skill gains a tokens and links section, with the full rules in its components reference, the Copilot run-time names in its targets reference and the token and link problems in its findings reference; it shows naming tools in prose with `{{tool …}}`, and agents with `{{agent …}}` because Copilot namespaces agent ids (`copilot --agent <plugin>:<agent>`)
- The pluginfinity skill's repository hygiene section explains that `build --check` compares content and a copied file's executable bit, and its tokens section that agent ids and skill commands use each host's plugin name while MCP tool names use the Claude Code name
- `migrating-hooks` now rewrites contract-pinning `hooks.json` tests against the generated hooks files instead of deleting them [#13][#13]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#13]: https://github.com/spencerbeggs/pluginfinity/pull/13

## 0.1.1

### Bug Fixes

- On Copilot, agent and skill tool lists drop names Copilot has no tool for: Claude-only tools such as `ToolSearch`, `SendMessage` and the `Task` tools, and another plugin's `mcp__plugin_...` MCP tools. Previously they were passed through. Claude Code keeps every name.
- Claude Code hook scripts are written in exec form, `"command": "bash"` with the script path in `args`, so no shell ever parses the path. A `command` entry is still written as the shell string you gave.
- The companion plugin's `pluginfinity` skill describes both changes. [#9][#9]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#9]: https://github.com/spencerbeggs/pluginfinity/pull/9

## 0.1.0

### Features

#### The `pluginfinity` plugin

- The first release of the pluginfinity companion plugin, for Claude Code and GitHub Copilot. It adds one skill, `pluginfinity`, which an agent loads when it works on a plugin that pluginfinity builds. The skill covers:

- the source layout and every field of `pluginfinity.config.ts`

- skill and agent frontmatter, `targets` blocks and host blocks

- hooks

- what each host gets for every field, tool and model

- every finding a command reports, with its cause and fix [#5][#5]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#5]: https://github.com/spencerbeggs/pluginfinity/pull/5
