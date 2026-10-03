---
"pluginfinity": minor
"@pluginfinity/core": minor
"@pluginfinity/targets": minor
"@pluginfinity/engine": minor
"@pluginfinity/cli": minor
---

## Features

### `pluginfinity build`

`build` turns one plugin source into `builds/claude/` and `builds/copilot/`:

* **Manifests.** Each host's manifest is written from the config, with its version from the `package.json` beside it. Claude Code gets `.claude-plugin/plugin.json`; Copilot gets an Agent Plugins 1.0 `plugin.json`.
* **Skills.** Every `skills/<name>/SKILL.md` is decoded strictly in Claude Code's field names. Each host's copy has its own frontmatter; on Copilot, `when_to_use` and `paths` fold into `description`. Support files ship too.
* **Agents.** Every `agents/<name>.md` is written to each host's agents directory. On Copilot, tools become its aliases, models and effort levels are translated, and `skills` becomes a section of the body.
* **Hooks.** Hooks declared in the config are written to each host's hooks file. Each target ships the `hooks/` directory along with every script and file a command names.
* **`targets` blocks.** A skill or agent can set fields for one host, or leave that host out.
* **Host blocks.** `<!-- pluginfinity:only <id> -->` blocks keep a passage for the listed hosts only.
* **Careful rewrites.** A build writes only the files that differ and removes files no longer produced. Unchanged files keep their mtimes.

### `build --check` and `validate`

`build --check` writes nothing and fails with `BuildStale` when `builds/` is out of date, naming every file. `validate` needs current builds, then runs `claude plugin validate` on the Claude Code build and checks that Copilot loads the Copilot build under the manifest's name and version.

### Findings

A problem is a finding with a message and a fix hint: exit 1, or one JSON object for agents and CI. Every skill and agent problem in a plugin is reported in a single run.

YAML that Claude Code reads more leniently than other hosts is refused rather than shipped. That covers a plain value holding `: ` or ` #`.

A `pluginfinity://` link fails until references are built, and so does a config that sets `mcpServers`.
