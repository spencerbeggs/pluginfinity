---
"@pluginfinity/cli": patch
---

## Bug Fixes

- `pluginfinity logs` now finds the state directory by the same rule the plugin scripts use to write their logs: `${XDG_STATE_HOME:-${HOME:-/nonexistent}/.local/state}`. With `HOME` empty or unset, `logs` reads `/nonexistent/.local/state`, where the scripts write, instead of falling back to the operating system's home directory. Closes #58.
