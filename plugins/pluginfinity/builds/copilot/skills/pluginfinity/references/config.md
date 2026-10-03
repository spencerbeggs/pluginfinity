# The config

`pluginfinity.config.ts` sits at the plugin root and default-exports `defineConfig({ ... })`, imported
from `pluginfinity`. pluginfinity finds it by walking up from the working directory, or from the
`[path]` a command is given; `--config <file>` names it directly, and `--all` builds every config below
`[path]`.

```ts
import { defineConfig } from "pluginfinity";

export default defineConfig({
  name: "my-plugin",
  description: "What the plugin gives an agent.",
  author: { name: "A. Author", email: "a@example.com" },
  scripts: { invoke: "bash" },
  hooks: {
    SessionStart: [{ script: "hooks/session-start.sh", timeout: 5 }],
  },
  claude: true,
  copilot: {
    hooks: { SessionStart: [{ script: "hooks/session-start.copilot.sh", timeout: 5 }] },
  },
});
```

## Fields

| Field | Required | Meaning |
| :-- | :-- | :-- |
| `name` | Yes | The plugin's name on every host: kebab-case, `a-z`, `0-9` and single hyphens |
| `description` | Yes | Written into every manifest |
| `author` | No | `{ name, email?, url? }` |
| `homepage`, `repository`, `license` | No | Strings, written into every manifest |
| `keywords` | No | A list of strings |
| `scripts.invoke` | No | How hook scripts run: `"bash"` (the default) or `"exec"`; see [hooks](hooks.md) |
| `hooks` | No | Hook entries keyed by Claude Code event name; see [hooks](hooks.md) |
| `mcpServers` | No | Accepted by the config, but not built yet |
| `claude`, `copilot` | At least one | Enables that target; see below |

The version is not a config field: every manifest copies `version` from the `package.json` beside the
config. Bump it there, or let changesets bump it.

An unknown top-level key fails, listing both the config fields and the known targets, so a misspelt
field is caught rather than read as a target.

## Target keys

A target is built when its key is set. `true` builds it with the base fields. An object builds it with
overrides:

- `name`: the plugin's name on that host, when it must differ.
- `hooks`: per-event replacements. An event listed here replaces the base entries for that event on
  that host only; `[]` removes the event there. Copilot's object also accepts `userPromptTransformed`
  and `errorOccurred`, events only Copilot has.
- `mcpServers`: accepted, not built yet.
