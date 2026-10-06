---
"@pluginfinity/cli": minor
---

## Features

### Build notes in build and validate output

`build`, `build --check` and `validate` now print, under each target's `✓` line, one indented line per source file the target dropped, degraded or omitted something from: `· <path>: <kind> <names>; <kind> <names>`, with the `config` line for hooks and servers last. Under `--agent` or `--ci`, each entry of `builds` and `validations` gains a `notes` array of `{ path, kind, name }`. Notes are information only and never change the exit code.
