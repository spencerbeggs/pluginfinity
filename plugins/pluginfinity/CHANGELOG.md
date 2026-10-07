# @pluginfinity/ai-plugins

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
