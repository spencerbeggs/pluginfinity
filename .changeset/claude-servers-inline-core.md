---
"@pluginfinity/core": patch
---

## Breaking Changes

* `Target.mcp.path` and `Target.lsp.path` are replaced by `placement`: `InFile` with a plugin-relative path, or `InManifest` with the manifest key the servers go under and the default server file it reserves, built with `inFile` and `inManifest`. A custom target description that set `path` must set `placement`.
* The Claude server formats `claude-mcp-json` and `claude-lsp-json` are now `claude-mcp-servers` and `claude-lsp-servers`, the bare name-to-server maps.

Before:

```ts
mcp: { path: ".mcp.json", format: "claude-mcp-json" }
```

After:

```ts
mcp: { placement: inManifest("mcpServers", ".mcp.json"), format: "claude-mcp-servers" }
```

For a target that keeps a file, write `placement: inFile("mcp.json")` and keep its format.

## Bug Fixes

* The new placement lets the Claude target write its servers inline in `plugin.json`, out of reach of a gitignored `.mcp.json`.
