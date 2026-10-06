---
"@pluginfinity/core": minor
---

## Features

### LSP servers and shipped files in the config

* `LspServer` and `LspServers` decode Claude Code's `.lsp.json` server shape, and `LSP_FIELDS` lists every LSP field for target field maps
* `BaseConfigFields` gains `lspServers` and `files`, validated by the new `ShippedPath`; target overrides gain `lspServers`
* `ServerEnv` rejects server `env` keys starting with `PLUGINFINITY_`, which the build reserves

### Run-time names on the Target schema

* `tools.runtime` describes the tool names a model sees at run time: `names` maps a Claude Code tool name to its run-time spelling or `unresolved`, `mcp` is the template for a plugin's own MCP tools (`{plugin}`, `{server}`, `{tool}`), and `unlisted` is `keep` or `unresolved`
* `agents.id` is a plugin agent's run-time id, a template over `{plugin}` and `{agent}`
* `skills.invoke` is how a user invokes a plugin skill, a template over `{plugin}` and `{skill}`, or `unresolved`

## Breaking Changes

* `Target` now requires `tools.runtime`, `agents.id` and `skills.invoke`; a hand-written `Target` must add all three
* `Target` now requires an `lsp` part (`path`, `format` from the new `LSP_FORMATS`, and a field map) and a `pluginRoot.lsp` spelling
