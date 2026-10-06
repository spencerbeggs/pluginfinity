---
"@pluginfinity/targets": minor
---

## Breaking Changes

* Target descriptions now declare monitor support. Claude Code builds monitors to `monitors/monitors.json`; Copilot declares none, so monitors are omitted with a build note. There is no compatibility shim.

## Features

* Copilot's description records the events whose matchers the host ignores (`SessionStart`, `SessionEnd`, `SubagentStop`) and which hook output fields it honors.
