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
    title: PluginName and TargetSetting
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
    title: McpServers
generated:
  by: okfit/claude-code
  at: 2026-10-02T23:30:51Z
  body_sha256: 4d144c40d38c9abbde81dafd394a48627973e0ad3e0568d61c0d352ab0d1d686
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
- **`scripts.invoke`** is `"bash"` (the default) or `"exec"`, how `script` hooks run.[^core-config]
- **Target keys** are top-level, one per known target: `claude` (Claude Code) and `copilot` (GitHub Copilot). Each is `true`, or an object that may set `name`, `hooks` and `mcpServers` for that host. An event under a target's `hooks` replaces the base entries for that event on that target, and `[]` removes them; `claude` admits Claude Code events only, and `copilot` also admits `subagentStart`, `notification`, `userPromptTransformed` and `errorOccurred`. A server under a target's `mcpServers` replaces the base server of that name. An absent key turns the target off, and `false` is rejected. At least one target must be enabled.[^targets-config]
- **Nothing else** is accepted. An unknown top-level key fails as `UnknownTarget`, and an unknown key inside a target object fails as `ConfigInvalid`.

`defineConfig` returns its argument unchanged and is typed against the schema, so a misspelt target key, `false` as a target value, or a missing `name` is a type error in the editor before pluginfinity ever loads the file.[^carrier-index]

## How it is found and loaded

- **Discovery** starts at `[path]` (the launch directory by default) and walks upward. It stops at the first config, or after the first directory that contains `.git`. With `--all`, every config below `[path]` is used, and `node_modules`, `builds` and `.git` are never searched. `--config <file>` names one file and skips discovery.[^discovery]
- **Loading** imports the file in-process through jiti, so TypeScript needs no build step, and it re-reads the file on every load. A syntax error or an unresolved import fails as `ConfigLoadFailed`.[^loader] Code in the config runs inside pluginfinity's process.
- **Every failure** names the config path and carries a one-line remediation hint.[^errors] The command line reports it as a finding with exit 1 ([CLI interface](cli.md)), and `doctor` reports it as a failed `config` check.

## What may change

Further base fields and per-target override keys arrive with the build pipeline ([roadmap](../roadmaps/pluginfinity-first-release.md)); hooks, MCP servers, scripts and manifest metadata have landed ([source model](../models/plugin-source-model.md)). A new host adds a new top-level key. Base keys and target ids share one key space, so no base field will ever take a target's id.

[^targets-config]: `../../packages/targets/src/config.ts`
[^core-config]: `../../packages/core/src/config.ts`
[^carrier-index]: `../../packages/pluginfinity/src/index.ts`
[^discovery]: `../../packages/engine/src/discovery.ts`
[^loader]: `../../packages/engine/src/loader.ts`
[^errors]: `../../packages/engine/src/errors.ts`
[^core-hooks]: `../../packages/core/src/hooks.ts`
[^core-mcp]: `../../packages/core/src/mcp.ts`
