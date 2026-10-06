---
"@pluginfinity/engine": patch
---

## Bug Fixes

* `build` writes Claude Code's MCP and LSP servers inline in `plugin.json` rather than to `.mcp.json` and `.lsp.json`, so a `.gitignore` that excludes `.mcp.json` no longer leaves a committed Claude build without its MCP server or makes `build --check` fail on a clean clone.
* A `.mcp.json` or `.lsp.json` an earlier build wrote is deleted by the next `build` and reported as removed by `build --check`; commit the deletion.
* A source file that would ship to a Claude build's root `.mcp.json` or `.lsp.json`, from `files` or a path a server names, fails with `PathConflict`, since Claude Code would load it beside the inline servers.
* `renderServers` returns the server maps a target places in its manifest under `manifest`, and `renderManifest` takes them as an optional argument.
