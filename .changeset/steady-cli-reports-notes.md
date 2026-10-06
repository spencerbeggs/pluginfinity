---
"@pluginfinity/cli": minor
---

## Breaking Changes

* `build`, `build --check` and `validate` follow the engine's new contract: a source `monitors/monitors.json` and a hook script path containing `=` under `scripts.invoke: "exec"` now fail. Migrate per the engine release notes; there is no compatibility shim.

## Features

* `build` reports the new `hook-matcher-runtime`, `hook-output-ignored` and `monitor-omitted` notes.
