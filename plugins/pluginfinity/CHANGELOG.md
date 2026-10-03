# @pluginfinity/ai-plugins

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
