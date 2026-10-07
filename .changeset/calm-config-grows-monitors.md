---
"@pluginfinity/core": minor
---

## Breaking Changes

* Hook entries carry `failClosed`, and a source `monitors/monitors.json` is rejected. Declare monitors in `pluginfinity.config.ts`; there is no compatibility shim. The build error is a `PathConflict` with reason `reserved-monitors-file`.

* `Target` requires two new fields, so a custom target description must add them: `skills.dirSpelling` (`own`, `other`, `agent`) and `hooks.envShell`. There is no compatibility shim.

## Features

* New `monitors` config component, keyed by name, with the `Monitors` schema exported. A monitor's `when` takes the bare skill name, so `on-skill-invoke:a:b` is rejected.
* New `env` config block (`EnvConfig`, `EnvVar`, `EnvVarName` exported): `vars` with `default` and `description`, an optional `prefix` every name must start with, and an optional plugin-relative `setup` script. Names match `^[A-Z_][A-Z0-9_]*$`, and `PATH`, `IFS`, `HOME`, `PWD`, `XDG_STATE_HOME`, `TMPDIR`, `SHELL`, `BASH_ENV`, `ENV`, `CDPATH`, `SHELLOPTS`, `BASHOPTS`, `PS4`, `PLUGINFINITY_*`, `_PF_*`, `CLAUDE_*`, `COPILOT_*`, `LD_*` and `DYLD_*` are reserved; a malformed or reserved name is reported at its `vars` key with the rule it breaks.
* Targets can describe how a skill body spells a skill directory (`skills.dirSpelling`) and which hook events pass exports to the model's shell (`hooks.envShell`).
* Targets can describe monitor support and hook matcher and output behavior, which drives the new build notes.
