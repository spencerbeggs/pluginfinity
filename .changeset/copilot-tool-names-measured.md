---
"@pluginfinity/targets": patch
---

## Bug Fixes

* Copilot agents and skills no longer lose `Grep`, `Glob`, `WebFetch` and `WebSearch`: they are now granted by the names Copilot executes (`grep`, `glob`, `web_fetch`, `web_search`) instead of the `search` and `web` aliases, which granted no tool in measurement
* `TodoWrite` is dropped on Copilot with a `tool-dropped` build note, since the `todo` alias granted no tool
