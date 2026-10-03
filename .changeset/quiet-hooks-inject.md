---
"@pluginfinity/engine": minor
---

## Features

### Host-neutral bash hook library

`pluginfinity build` now injects a bash hook library, `hook.sh`, plus a generated `host.sh` into `hooks/lib/pluginfinity/` of every target that has hooks. Hook scripts can source it to read hook input and emit decisions the same way on Claude Code and GitHub Copilot.

* The library reads Copilot's `tool_input` key names through Claude's names, so one script handles both hosts
* Setting `PLUGINFINITY_HOOK_DEBUG=1` logs the raw hook input for debugging
* Copilot hook entries now carry `env: { PLUGINFINITY_EVENT: <event> }` so the library knows which event fired

## Breaking Changes

* A plugin source file at or under `hooks/lib/pluginfinity/` is now reported as a PathConflict, because that path is owned by the build
* Every target with hooks, not only Copilot, gains `hooks/lib/pluginfinity/{hook.sh,host.sh}`, so existing builds drift on upgrade; rebuild to refresh them
* `host.sh` stamps the engine version, so every pluginfinity upgrade needs a rebuild, and `pluginfinity build --check` reports the library as drift until then
* Copilot hook entries now carry `env: { PLUGINFINITY_EVENT: <event> }`, which also shows as drift until rebuilt
