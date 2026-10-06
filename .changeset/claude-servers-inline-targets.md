---
"@pluginfinity/targets": patch
---

## Bug Fixes

* The `claude` target now places its MCP and LSP servers inline in `.claude-plugin/plugin.json`, under `mcpServers` and `lspServers`, instead of a root `.mcp.json` and `.lsp.json`. Repositories conventionally gitignore `.mcp.json` as local dev config, so a committed Claude build shipped no MCP server and `build --check` failed on every clean clone.
* The `claude` manifest key allowlist admits `mcpServers` and `lspServers`, after the metadata keys.
* The `copilot` target is unchanged: root `mcp.json` and `com.github.copilot/lsp.json`, now declared as file placements.
