# pluginfinity

[![npm](https://img.shields.io/npm/v/pluginfinity?label=npm&color=cb3837)](https://www.npmjs.com/package/pluginfinity)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Build one host-neutral agent-plugin source (skills, agents, hooks and a `pluginfinity.config.ts`) into a complete, self-contained plugin for every host it targets, starting with Claude Code and GitHub Copilot.

> **Under development.** pluginfinity is in early `0.x` development. These packages install and run, but they do not build plugins yet: `build`, `validate`, `init` and `plugin add` check their input and then stop with "not implemented yet". Only `doctor` does its full job today. Expect breaking changes between `0.x` releases, and pin an exact version if you depend on it.

## Why pluginfinity

A plugin that ships to several agent hosts usually keeps a hand-ported copy per host, and the copies drift. Each host accepts different manifest keys, frontmatter fields, hook events and path conventions. pluginfinity replaces the porting with a build: you write the plugin once, and per-host differences are either produced mechanically or marked explicitly in that one source. Generated output goes to `builds/<target>/`, regenerated from source on every build.

## Install

```bash
pnpm add -D pluginfinity
```

```bash
npm install --save-dev pluginfinity
```

Requires Node.js >=24.11.0. This is the one package to install: it provides the `pluginfinity` command and the `defineConfig` helper. The `@pluginfinity/*` packages it depends on are internal layers, not a supported API.

## Configure

A plugin is a directory with a `pluginfinity.config.ts` (`.mts`, `.js` and `.mjs` also work). Each target is a top-level key, set to `true` or to an object of per-host overrides:

```ts
import { defineConfig } from "pluginfinity";

export default defineConfig({
  name: "my-plugin",
  claude: true,
  copilot: { name: "my-plugin-for-copilot" },
});
```

`name` is the plugin's name for every host unless a target overrides it. A target key that is absent is not built. pluginfinity finds the nearest config by walking up from the current directory, stopping at the repository root.

## Commands

| Command | Status |
| :-- | :-- |
| `pluginfinity doctor [path]` | Works. Checks Node.js, the package manager, the host CLIs your config targets, bats, git and whether the config loads. Add `--strict` to exit 1 when a required check fails. |
| `pluginfinity build [path]` | Finds and checks the config, then stops: not implemented yet. |
| `pluginfinity validate [path]` | Finds and checks the config, then stops: not implemented yet. |
| `pluginfinity init [dir]` | Checks its flags, then stops: not implemented yet. |
| `pluginfinity plugin add <name>` | Checks its flags, then stops: not implemented yet. |

Run `pluginfinity <command> --help` for the flags. Every command takes `--agent`, `--human` or `--ci` to choose its output: readable text for people, JSON on stdout for agents and CI. Exit codes are 0 for success, 1 for findings (a config problem, or a failed `doctor --strict`) and 64 for a usage error.

## License

[MIT](LICENSE)
