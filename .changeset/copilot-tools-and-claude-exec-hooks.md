---
"pluginfinity": patch
"@pluginfinity/core": patch
"@pluginfinity/targets": patch
"@pluginfinity/engine": patch
"@pluginfinity/ai-plugins": patch
---

## Bug Fixes

* On Copilot, agent and skill tool lists drop names Copilot has no tool for: Claude-only tools such as `ToolSearch`, `SendMessage` and the `Task` tools, and another plugin's `mcp__plugin_...` MCP tools. Previously they were passed through. Claude Code keeps every name.
* Claude Code hook scripts are written in exec form, `"command": "bash"` with the script path in `args`, so no shell ever parses the path. A `command` entry is still written as the shell string you gave.
* The companion plugin's `pluginfinity` skill describes both changes.
