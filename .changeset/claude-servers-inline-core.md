---
"@pluginfinity/core": patch
---

## Bug Fixes

* `Target.mcp` and `Target.lsp` take a `placement` instead of a `path`: `InFile` with a plugin-relative path, or `InManifest` with the manifest key the servers go under, built with `inFile` and `inManifest`. This lets the Claude target write its servers inline in `plugin.json`, out of reach of a gitignored `.mcp.json`.
* The Claude server formats are now `claude-mcp-servers` and `claude-lsp-servers`, the bare name-to-server maps, replacing `claude-mcp-json` and `claude-lsp-json`.
