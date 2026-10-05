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
| `mcpServers` | No | MCP servers in Claude Code's `.mcp.json` shape; see below |
| `lspServers` | No | LSP servers in Claude Code's `.lsp.json` shape; see below |
| `files` | No | Plugin-relative files, or directories ending in `/`, shipped to every target |
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
- `mcpServers`, `lspServers`: a server here replaces the base server of the same name on that host.

## Servers

- **An MCP server** is local, `command` with optional `args`, `env` and `cwd` (and `type: "stdio"`), or
  remote, `type` `"http"` or `"sse"` with `url` and optional `headers`.
- **An LSP server** needs `command` and `extensionToLanguage` (keys start with `.`, like `".ts"`). It may
  set `args`, `env`, `initializationOptions`, `settings`, `workspaceFolder`, `startupTimeout`,
  `shutdownTimeout`, `restartOnCrash`, `maxRestarts` and `diagnostics`. Any other key fails.
- **`${PLUGIN_ROOT}`** is rewritten only in a local MCP server's `command`, `args`, `env` values and
  `cwd`, and an LSP server's `command`, `args`, `env` values and `workspaceFolder`. Every path named
  after it there ships with that host's build: a file, or every file under a directory. A path ends at
  whitespace, a quote, a shell metacharacter, `:` or `,`. A host spelling such as `${CLAUDE_PLUGIN_ROOT}`,
  or a brace-less `$PLUGIN_ROOT`, in those fields fails the build; write `${PLUGIN_ROOT}`.
- **`env` keys starting with `PLUGINFINITY_` fail.** The build injects `PLUGINFINITY_HOST`,
  `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB` itself.
- **A `files` entry** is a canonical relative path: no empty, `.` or `..` segment, not the plugin root,
  and not under `builds/` or `node_modules/`. Only the base config has `files`.
