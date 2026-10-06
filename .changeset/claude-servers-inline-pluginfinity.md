---
"pluginfinity": patch
---

## Bug Fixes

* `pluginfinity build` now writes a Claude Code plugin's MCP and LSP servers inline in `.claude-plugin/plugin.json` instead of a root `.mcp.json` and `.lsp.json`. Many repositories gitignore `.mcp.json`, so the committed Claude build silently registered no MCP server and `build --check` failed on every clean checkout. The next build deletes the old files; commit the deletion. Copilot output is unchanged.
