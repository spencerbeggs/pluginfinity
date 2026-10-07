---
"@pluginfinity/targets": minor
---

## Breaking Changes

* Target descriptions now declare monitor support. Claude Code builds monitors to `monitors/monitors.json`; Copilot declares none, so monitors are omitted with a build note. There is no compatibility shim.

* Both descriptions carry the new required `Target` fields: `skills.dirSpelling` and `hooks.envShell`.

## Features

* Claude Code spells a skill directory `${CLAUDE_SKILL_DIR}` (own) and `${CLAUDE_PLUGIN_ROOT}/skills/{skill}`, and passes hook exports to the model's shell from `SessionStart`, `Setup`, `CwdChanged` and `FileChanged`. Copilot spells it with the placeholder `<skill base directory>` (unresolved from an agent) and passes none, since no env-file mechanism is known.
* Copilot's description records the events whose matchers the host ignores (`SessionStart`, `SessionEnd`, `SubagentStop`) and which hook output fields it honors.
