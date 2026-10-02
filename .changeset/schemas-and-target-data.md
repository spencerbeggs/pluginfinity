---
"pluginfinity": minor
"@pluginfinity/core": minor
"@pluginfinity/targets": minor
---

## Breaking Changes

* `pluginfinity.config.ts` now requires a non-empty `description`

## Features

* The config accepts `author`, `homepage`, `repository`, `license` and `keywords` for the generated manifests
* `hooks` declares hooks once, keyed by Claude Code event names, with `script` or `command` entries; `claude` and `copilot` can override them per event
* `mcpServers` declares MCP servers in Claude Code's `.mcp.json` shape, with per-target overrides
* `scripts.invoke` chooses whether `script` hooks run through `bash` (the default) or directly
* The `claude` and `copilot` targets are described as data, ready for the build pipeline
