---
"@pluginfinity/engine": patch
---

## Breaking Changes

* `ServerRender.files` no longer holds Claude Code's server files, since a target that places servers in its manifest writes none. `ServerRender.manifest` is added and carries those maps by manifest key, and `renderManifest` takes them as an optional argument.
* `PathConflict` gains a required `conflict` field, `generated`, `reserved-dir` or `reserved-server-file`, and its message and remediation now say which. A source `.mcp.json` or `.lsp.json` is rejected for a Claude build only when that build has inline `mcpServers` or `lspServers`; a plugin without them ships its own file as before.

## Bug Fixes

* `build` writes Claude Code's MCP and LSP servers inline in `plugin.json` rather than to `.mcp.json` and `.lsp.json`, so a `.gitignore` that excludes `.mcp.json` no longer leaves a committed Claude build without its MCP server or makes `build --check` fail on a clean clone.
* A `.mcp.json` or `.lsp.json` an earlier build wrote is deleted by the next `build` and reported as removed by `build --check`; commit the deletion.
