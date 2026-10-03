---
"pluginfinity": minor
---

## Features

### bats helper for testing built hooks

The package now ships `bats/pluginfinity.bash`, a bats helper for testing a plugin's built hooks. It provides `run_hook`, a set of assert functions and `hook_fixture`, so hook tests can feed fixture input to a built hook and assert on its output and exit status.

### Host-neutral bash hook library

`pluginfinity build` now injects a bash hook library, `hook.sh`, plus a generated `host.sh` into `hooks/lib/pluginfinity/` of every target that has hooks. Hook scripts source it to read hook input and emit decisions the same way on Claude Code and GitHub Copilot.

* Setting `PLUGINFINITY_HOOK_DEBUG=1` logs each hook's raw input to a plaintext debug log
* Copilot hook entries now carry `env: { PLUGINFINITY_EVENT: <event> }`

## Breaking Changes

* A plugin source file at or under `hooks/lib/pluginfinity/` is now reported as a PathConflict, because that path is owned by the build
* Every target with hooks gains `hooks/lib/pluginfinity/{hook.sh,host.sh}`, so existing builds drift on upgrade; rebuild to refresh them
* `host.sh` stamps the engine version, so every pluginfinity upgrade needs a rebuild, and `pluginfinity build --check` reports the library as drift until then
