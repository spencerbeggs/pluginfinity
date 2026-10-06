---
type: Interface
kind: config
title: pluginfinity.config.ts
description: The per-plugin config file, written with defineConfig from the pluginfinity carrier; a name plus one top-level key per enabled target, discovered upward to the .git boundary and decoded strictly.
resource: ../../packages/targets/src/config.ts
status: draft
tags:
  - dx
  - portability
sources:
  - id: targets-config
    resource: ../../packages/targets/src/config.ts
    title: The assembled PluginfinityConfig schema
  - id: core-config
    resource: ../../packages/core/src/config.ts
    title: PluginName, BaseConfigFields and makeTargetSetting
  - id: carrier-index
    resource: ../../packages/pluginfinity/src/index.ts
    title: defineConfig
  - id: discovery
    resource: ../../packages/engine/src/discovery.ts
    title: File names and discovery
  - id: loader
    resource: ../../packages/engine/src/loader.ts
    title: How a config is loaded and decoded
  - id: errors
    resource: ../../packages/engine/src/errors.ts
    title: The config errors
  - id: core-hooks
    resource: ../../packages/core/src/hooks.ts
    title: Hooks and HookEntry
  - id: core-mcp
    resource: ../../packages/core/src/mcp.ts
    title: McpServers and the reserved ServerEnv
  - id: core-lsp
    resource: ../../packages/core/src/lsp.ts
    title: LspServers
generated:
  by: okfit/claude-code
  at: 2026-10-05T18:30:14Z
  body_sha256: 556e9c929f1779ed2e3dcc5ff985867e38b6d3dc2681bdf182c9b724afcccd36
---

# pluginfinity.config.ts

Every plugin pluginfinity builds has one config file at its root. The directory holding the config is the plugin root. The config's types and its `defineConfig` helper are the one library surface pluginfinity supports ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).

## The file

```ts
import { defineConfig } from "pluginfinity";

export default defineConfig({
  name: "foo",
  description: "What foo does",
  claude: { name: "baz" },
  copilot: true,
});
```

- **The file name** is `pluginfinity.config.ts`, `.mts`, `.js` or `.mjs`. A directory with more than one of them fails as `ConfigAmbiguous`.[^discovery]
- **The default export** is the config. A file with no default export fails as `ConfigInvalid`.[^loader]
- **`name`** is required. It is the plugin's name on every host, must be kebab-case (lowercase letters and digits separated by single hyphens), and is not read from `package.json`.[^core-config]
- **`description`** is required and non-empty; every host shows it. `author` (`name`, optional `email` and `url`), `homepage`, `repository`, `license` and `keywords` are optional and are written into each target's manifest.[^core-config]
- **`hooks`** maps Claude Code event names to hook entries. An entry has exactly one of `script` (a path relative to the plugin root, with optional `args`) or `command` (a string whose one placeholder is `${PLUGIN_ROOT}`), and optional `matcher`, `timeout` (positive whole seconds) and `fallback` (`"fail"`, the default, or `"omit"`).[^core-hooks]
- **`mcpServers`** maps server names to Claude Code's `.mcp.json` server shape: `command` with optional `args`, `env` and `cwd`, or `type` (`http` or `sse`) with `url` and optional `headers`.[^core-mcp]
- **`lspServers`** maps server names to Claude Code's `.lsp.json` server shape: required `command` (non-empty) and `extensionToLanguage` (keys start with `.`, like `.ts`), and optional `args`, `env`, `initializationOptions`, `settings`, `workspaceFolder`, `startupTimeout`, `shutdownTimeout`, `maxRestarts` (whole numbers, zero or more), `restartOnCrash` and `diagnostics`.[^core-lsp]
- **`${PLUGIN_ROOT}`** is the one placeholder in a server: in a local MCP server's `command`, `args`, `env` values and `cwd`, and in an LSP server's `command`, `args`, `env` values and `workspaceFolder`. It is not expanded in a remote MCP server, `initializationOptions` or `settings`. A host's own spelling (`${CLAUDE_PLUGIN_ROOT}`, `${COPILOT_PLUGIN_ROOT}`, or either without braces) or a brace-less `$PLUGIN_ROOT` in those fields fails the build. Each `${PLUGIN_ROOT}/<path>` there ships to the target: the path ends at whitespace, a quote, a shell metacharacter, `:` or `,`, and a directory ships every file under it.
- **Server `env`** keys starting with `PLUGINFINITY_` fail as `ConfigInvalid`; that prefix is reserved for the variables the build injects.[^core-mcp]
- **`files`** is a list of plugin-relative paths, each a file or a directory ending in `/`, shipped to every target. An entry must be canonical (relative, no empty, `.` or `..` segment, not the plugin root) and must not be or lie under `builds/` or `node_modules/`, or it fails as `ConfigInvalid`. That an entry exists and stays inside the plugin is checked at build time ([CLI interface](cli.md)). Only the base config has `files`.[^core-config]
- **`scripts.invoke`** is `"bash"` (the default) or `"exec"`, how `script` hooks run.[^core-config]
- **Target keys** are top-level, one per known target: `claude` (Claude Code) and `copilot` (GitHub Copilot). Each is `true`, or an object that may set `name`, `hooks`, `mcpServers` and `lspServers` for that host. An event under a target's `hooks` replaces the base entries for that event on that target, and `[]` removes them; `claude` admits Claude Code events only, and a `copilot` override uses Claude Code event names, plus `userPromptTransformed` and `errorOccurred`, which only Copilot has. A server under a target's `mcpServers` or `lspServers` replaces the base server of that name. An absent key turns the target off, and `false` is rejected. At least one target must be enabled.[^targets-config]
- **Nothing else** is accepted. An unknown top-level key fails as `UnknownTarget`, and an unknown key inside a target object fails as `ConfigInvalid`.

`defineConfig` returns its argument unchanged and is typed against the schema, so a misspelt target key, `false` as a target value, or a missing `name` is a type error in the editor before pluginfinity ever loads the file.[^carrier-index]

## How it is found and loaded

- **Discovery** starts at `[path]` (the launch directory by default) and walks upward. It stops at the first config, or after the first directory that contains `.git`. With `--all`, every config below `[path]` is used, and `node_modules`, `builds` and `.git` are never searched. `--config <file>` names one file and skips discovery.[^discovery]
- **Loading** imports the file in-process through jiti, so TypeScript needs no build step, and it re-reads the file on every load. A syntax error or an unresolved import fails as `ConfigLoadFailed`.[^loader] Code in the config runs inside pluginfinity's process.
- **Every failure** names the config path and carries a one-line remediation hint.[^errors] The command line reports it as a finding with exit 1 ([CLI interface](cli.md)), and `doctor` reports it as a failed `config` check.

## What may change

Further base fields and per-target override keys arrive with the build pipeline ([roadmap](../roadmaps/pluginfinity-first-release.md)); hooks, MCP and LSP servers, shipped `files`, scripts and manifest metadata have landed ([source model](../models/plugin-source-model.md)). A new host adds a new top-level key. Base keys and target ids share one key space, so no base field will ever take a target's id.

[^targets-config]: `../../packages/targets/src/config.ts`
[^core-config]: `../../packages/core/src/config.ts`
[^carrier-index]: `../../packages/pluginfinity/src/index.ts`
[^discovery]: `../../packages/engine/src/discovery.ts`
[^loader]: `../../packages/engine/src/loader.ts`
[^errors]: `../../packages/engine/src/errors.ts`
[^core-hooks]: `../../packages/core/src/hooks.ts`
[^core-mcp]: `../../packages/core/src/mcp.ts`
[^core-lsp]: `../../packages/core/src/lsp.ts`
