---
"@pluginfinity/engine": minor
---

## Features

### MCP and LSP servers

`build` and `validate` now build `mcpServers` and `lspServers` instead of failing with `NotImplemented`. `renderServers` writes each target's server files through one encoder per MCP and LSP format, rewriting `${PLUGIN_ROOT}` only in the fields the hosts expand it in, and `serverFiles` lists the plugin files the servers name.

* Server files named after `${PLUGIN_ROOT}/` and the entries of the new `files` key ship with each target's build
* A new `ShippedFileInvalid` build error, with `ShippedFileProblem` (`missing`, `not-executable`, `outside-root`, `not-normal`), reports a file that cannot ship
* Targets with a local server get the injected server library at `lib/pluginfinity/server.sh`, and each local server's `env` gains `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB`

## Breaking Changes

* `PlanError` no longer includes `NotImplemented`, and `BuildError` now includes `ShippedFileInvalid`
* `lib/pluginfinity/` is reserved in every target: a shipped source file there fails with `PathConflict`
