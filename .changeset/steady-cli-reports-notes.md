---
"@pluginfinity/cli": minor
---

## Breaking Changes

* `build`, `build --check` and `validate` follow the engine's new contract: a source `monitors/monitors.json` and a hook script path containing `=` under `scripts.invoke: "exec"` now fail. Migrate per the engine release notes; there is no compatibility shim.
* `LaunchFacts` and `ProgramDeps` gained a required `stateHome`, the XDG state directory `logs` reads; a caller of `run` or `program` must pass it.

## Features

* `build` reports the new `hook-matcher-runtime`, `hook-output-ignored` and `monitor-omitted` notes.
* `logs` is new: `pluginfinity logs [--plugin <name>] [--debug] [--follow] [--lines <n>]` shows the logs plugins write under `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/`, the config's plugin names by default and every plugin outside one, with `--follow` to keep reading and JSON for agents and CI.
