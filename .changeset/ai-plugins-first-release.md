---
"@pluginfinity/ai-plugins": minor
---

## Features

### The `pluginfinity` plugin

The first release of the pluginfinity companion plugin, for Claude Code and GitHub Copilot. It adds one skill, `pluginfinity`, which an agent loads when it works on a plugin that pluginfinity builds. The skill covers:

* the source layout and every field of `pluginfinity.config.ts`
* skill and agent frontmatter, `targets` blocks and host blocks
* hooks
* what each host gets for every field, tool and model
* every finding a command reports, with its cause and fix
