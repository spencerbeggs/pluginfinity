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
generated:
  by: okfit/claude-code
  at: 2026-10-02T19:34:21Z
  body_sha256: dbae5939e2eb33fb5f2edcb65579596d7367b0e9e053b0deb2167f4211294250
---

# pluginfinity.config.ts

Every plugin pluginfinity builds has one config file at its root. The directory holding the config is the plugin root. The config's types and its `defineConfig` helper are the one library surface pluginfinity supports ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).

## The file

```ts
import { defineConfig } from "pluginfinity";

export default defineConfig({
  name: "foo",
  claude: { name: "baz" },
  copilot: true,
});
```

- **The file name** is `pluginfinity.config.ts`, `.mts`, `.js` or `.mjs`. A directory with more than one of them fails as `ConfigAmbiguous`.[^discovery]
- **The default export** is the config. A file with no default export fails as `ConfigInvalid`.[^loader]
- **`name`** is required. It is the plugin's name on every host, must be kebab-case (lowercase letters and digits separated by single hyphens), and is not read from `package.json`.[^core-config]
- **Target keys** are top-level, one per known target: `claude` (Claude Code) and `copilot` (GitHub Copilot). Each is `true`, or an object that may set `name` to override the plugin's name on that host. An absent key turns the target off, and `false` is rejected. At least one target must be enabled.[^targets-config]
- **Nothing else** is accepted. An unknown top-level key fails as `UnknownTarget`, and an unknown key inside a target object fails as `ConfigInvalid`.

`defineConfig` returns its argument unchanged and is typed against the schema, so a misspelt target key, `false` as a target value, or a missing `name` is a type error in the editor before pluginfinity ever loads the file.[^carrier-index]

## How it is found and loaded

- **Discovery** starts at `[path]` (the launch directory by default) and walks upward. It stops at the first config, or after the first directory that contains `.git`. With `--all`, every config below `[path]` is used, and `node_modules`, `builds` and `.git` are never searched. `--config <file>` names one file and skips discovery.[^discovery]
- **Loading** imports the file in-process through jiti, so TypeScript needs no build step, and it re-reads the file on every load. A syntax error or an unresolved import fails as `ConfigLoadFailed`.[^loader] Code in the config runs inside pluginfinity's process.
- **Every failure** names the config path and carries a one-line remediation hint.[^errors] The command line reports it as a finding with exit 1 ([CLI interface](cli.md)), and `doctor` reports it as a failed `config` check.

## What may change

The base fields and the per-target override object are expected to grow as the `Target` schema and the build pipeline land ([roadmap](../roadmaps/pluginfinity-first-release.md)). A new host adds a new top-level key. Base keys and target ids share one key space, so no base field will ever take a target's id.

[^targets-config]: `../../packages/targets/src/config.ts`
[^core-config]: `../../packages/core/src/config.ts`
[^carrier-index]: `../../packages/pluginfinity/src/index.ts`
[^discovery]: `../../packages/engine/src/discovery.ts`
[^loader]: `../../packages/engine/src/loader.ts`
[^errors]: `../../packages/engine/src/errors.ts`
