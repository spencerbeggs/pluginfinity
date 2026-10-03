# @pluginfinity/core

## 0.1.1

### Bug Fixes

- On Copilot, agent and skill tool lists drop names Copilot has no tool for: Claude-only tools such as `ToolSearch`, `SendMessage` and the `Task` tools, and another plugin's `mcp__plugin_...` MCP tools. Previously they were passed through. Claude Code keeps every name.
- Claude Code hook scripts are written in exec form, `"command": "bash"` with the script path in `args`, so no shell ever parses the path. A `command` entry is still written as the shell string you gave.
- The companion plugin's `pluginfinity` skill describes both changes. [#9][#9]

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

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!
