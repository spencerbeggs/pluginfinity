---
"@pluginfinity/cli": patch
---

## Refactoring

- The carrier's distribution now goes through `CliRuntime.main`'s `distribution` option. That option provides `CurrentDistribution` and appends the `via <name> <version>` suffix to `--version`, replacing the hand-built suffix. The version line and the `distribution` field in JSON output are unchanged.
- `logs --follow` now polls on `Schedule.spaced` instead of a hand-written sleep loop, with the same cadence.
- Dropped the stderr terminal override, because the platform's own check is identical.
