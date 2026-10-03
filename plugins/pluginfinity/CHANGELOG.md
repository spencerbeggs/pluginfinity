# @pluginfinity/ai-plugins

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
