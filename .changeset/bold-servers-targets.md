---
"@pluginfinity/targets": minor
---

## Features

* The Claude Code and Copilot targets describe LSP servers: `.lsp.json` with every field kept on Claude Code, and `com.github.copilot/lsp.json` on Copilot, which renames `extensionToLanguage` to `fileExtensions`, drops the lifecycle fields, and leaves `workspaceFolder` and `settings` unresolved
* Both targets spell the plugin root for LSP config, as `${CLAUDE_PLUGIN_ROOT}` and `${PLUGIN_ROOT}`
* Both targets describe run-time names for body tokens: Claude Code keeps every tool name and spells its own MCP tools `mcp__plugin_{plugin}_{server}__{tool}`; Copilot uses its measured names (`view`, `bash`, `edit`, `create`, `task`, `grep`, `glob`, `web_fetch`, `web_search`, `skill`), `{server}-{tool}` for a plugin's own MCP tools, and leaves `TodoWrite`, the notebook tools, `PowerShell` and any unlisted name unresolved
* Both targets spell an agent id `{plugin}:{agent}` and a skill invocation `/{plugin}:{skill}`

## Bug Fixes

* Copilot agents and skills no longer lose `Grep`, `Glob`, `WebFetch` and `WebSearch`: they are now granted by the names Copilot executes (`grep`, `glob`, `web_fetch`, `web_search`) instead of the `search` and `web` aliases, which granted no tool in measurement
* `TodoWrite` is dropped on Copilot with a `tool-dropped` build note, since the `todo` alias granted no tool
