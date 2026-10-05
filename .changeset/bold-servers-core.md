---
"@pluginfinity/core": minor
---

## Features

### LSP servers and shipped files in the config

* `LspServer` and `LspServers` decode Claude Code's `.lsp.json` server shape, and `LSP_FIELDS` lists every LSP field for target field maps
* `BaseConfigFields` gains `lspServers` and `files`, validated by the new `ShippedPath`; target overrides gain `lspServers`
* `ServerEnv` rejects server `env` keys starting with `PLUGINFINITY_`, which the build reserves

## Breaking Changes

* `Target` now requires an `lsp` part (`path`, `format` from the new `LSP_FORMATS`, and a field map) and a `pluginRoot.lsp` spelling
