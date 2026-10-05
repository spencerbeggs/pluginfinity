---
"@pluginfinity/ai-plugins": minor
---

## Features

### plugin-engineer agent

A new `plugin-engineer` agent for writing, testing and migrating hooks and plugin scripts in a pluginfinity plugin. It works bats-first against both the Claude Code and GitHub Copilot builds, and can convert a plugin-bot-era plugin (vendored `hooks/lib`, `emit_*` calls, hand-written `hooks.json`) to the build-injected hook library.

### Hook and script skills

* `hook-authoring` walks the bats-first loop for adding a hook, with tested recipes
* `hook-events` explains what each hook event can do on each host, the input it sends and the measured host differences
* `plugin-scripts` covers finding the plugin root and data directory, calling CLIs without leaking credentials, and persistent state
* `migrating-hooks` inventories an old plugin and maps every old helper to the hook library

## Documentation

* The pluginfinity skill's `references/hooks.md` now teaches the build-injected hook library, including Copilot `tool_input` aliasing and raw-input debugging
* The same reference now covers the bats helper for testing built hooks
* The pluginfinity skill and its config, targets and findings references now cover MCP and LSP servers, shipped `files`, and the per-host server rules
* `plugin-scripts` now teaches server launchers on the build-injected server library
