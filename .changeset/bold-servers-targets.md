---
"@pluginfinity/targets": minor
---

## Features

* The Claude Code and Copilot targets describe LSP servers: `.lsp.json` with every field kept on Claude Code, and `com.github.copilot/lsp.json` on Copilot, which renames `extensionToLanguage` to `fileExtensions`, drops the lifecycle fields, and leaves `workspaceFolder` and `settings` unresolved
* Both targets spell the plugin root for LSP config, as `${CLAUDE_PLUGIN_ROOT}` and `${PLUGIN_ROOT}`
