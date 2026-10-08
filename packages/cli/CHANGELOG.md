# @pluginfinity/cli

## 0.3.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/cli | dependency | updated | ^0.14.0 | ^0.15.0 |

[#22][#22]

### Thanks

Thanks to [@spencerbeggs](https://github.com/apps/spencerbeggs) for their contributions!

[#22]: https://github.com/spencerbeggs/pluginfinity/pull/22

## 0.3.0

### Breaking Changes

- `build`, `build --check` and `validate` follow the engine's new contract: a source `monitors/monitors.json` and a hook script path containing `=` under `scripts.invoke: "exec"` now fail. Migrate per the engine release notes; there is no compatibility shim.
- `LaunchFacts` and `ProgramDeps` gained a required `stateHome`, the XDG state directory `logs` reads; a caller of `run` or `program` must pass it.

### Features

- `build` reports the new `hook-matcher-runtime`, `hook-output-ignored` and `monitor-omitted` notes, and `env-shell-unsupported`, `env-wait-timeout`, `hook-matcher-widened` and `hook-matcher-regex`.
- `logs` is new: `pluginfinity logs [--plugin <name>] [--debug] [--follow] [--lines <n>]` shows the logs plugins write under `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/`, the config's plugin names by default and every plugin outside one, with `--follow` to keep reading and JSON for agents and CI. [#18][#18]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/core | dependency | updated | 0.2.1 | 0.3.0 |
| @pluginfinity/engine | dependency | updated | 0.2.1 | 0.3.0 |
| @pluginfinity/targets | dependency | updated | 0.2.1 | 0.3.0 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#18]: https://github.com/spencerbeggs/pluginfinity/pull/18

## 0.2.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/core | dependency | updated | 0.2.0 | 0.2.1 |
| @pluginfinity/engine | dependency | updated | 0.2.0 | 0.2.1 |
| @pluginfinity/targets | dependency | updated | 0.2.0 | 0.2.1 |

## 0.2.0

### Features

#### Build notes in build and validate output

- `build`, `build --check` and `validate` now print, under each target's `✓` line, one indented line per source file the target dropped, degraded or omitted something from: `· <path>: <kind> <names>; <kind> <names>`, with the `config` line for hooks and servers last. Under `--agent` or `--ci`, each entry of `builds` and `validations` gains a `notes` array of `{ path, kind, name }`. Notes are information only and never change the exit code. [#13][#13]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effect/platform-node | dependency | updated | ^4.0.0 | ^4.0.1 |
| @effected/cli | dependency | updated | ^0.11.0 | ^0.13.0 |
| @effected/engine | dependency | updated | ^0.3.0 | ^0.4.0 |
| @pluginfinity/core | dependency | updated | 0.1.1 | 0.2.0 |
| @pluginfinity/engine | dependency | updated | 0.1.1 | 0.2.0 |
| @pluginfinity/targets | dependency | updated | 0.1.1 | 0.2.0 |
| effect | dependency | updated | ^4.0.0 | ^4.0.1 |

[#13][#13]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#13]: https://github.com/spencerbeggs/pluginfinity/pull/13

## 0.1.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/core | dependency | updated | 0.1.0 | 0.1.1 |
| @pluginfinity/engine | dependency | updated | 0.1.0 | 0.1.1 |
| @pluginfinity/targets | dependency | updated | 0.1.0 | 0.1.1 |

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
| @pluginfinity/core | dependency | updated | 0.0.0 | 0.0.1 |
| @pluginfinity/engine | dependency | updated | 0.0.0 | 0.0.1 |
| @pluginfinity/targets | dependency | updated | 0.0.0 | 0.0.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!
