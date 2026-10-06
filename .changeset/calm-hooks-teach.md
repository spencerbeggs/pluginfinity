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
* `plugin-scripts` now teaches server launchers on the build-injected server library, including `server_exec_bin --install`
* The pluginfinity skill and its references now explain build notes, how a skill or agent names its own MCP tools, running pluginfinity from the repository root, keeping formatters and commit hooks off `builds/`, mirroring the version after `changeset version`, and that `plugin add` is a stub
* `hook-authoring` and the hooks reference now cover `hook_cd_project`, branching on `hook_supports` for a capability one host lacks, the hook library's runtime commands, `hook_event_name` in test fixtures, and loading the bats helper from a monorepo root
* The pluginfinity skill gains a tokens and links section, with the full rules in its components reference, the Copilot run-time names in its targets reference and the token and link problems in its findings reference; it shows naming tools in prose with `{{tool …}}`, and agents with `{{agent …}}` because Copilot namespaces agent ids (`copilot --agent <plugin>:<agent>`)
* `migrating-hooks` now rewrites contract-pinning `hooks.json` tests against the generated hooks files instead of deleting them
