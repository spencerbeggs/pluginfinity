---
"@pluginfinity/ai-plugins": minor
---

## Features

### Native hooks skill

A new `native-hooks` skill covers writing a hook as a compiled Zig program: setup, the write, test and build loop, the rules a native hook must keep, and a troubleshooting table. Its references hold the library's API, the Zig 0.17 spellings that differ from older Zig, and five tested recipes.

### Hook event schemas

The `hook-events` skill now ships a JSON Schema for the input and output of every Claude Code hook event, and for each built-in tool's `tool_input`, under `references/schemas/`. Each field carries a description, and a field Claude Code discards on an event is absent from that event's output schema.

## Documentation

* The hooks reference covers `binary`, `http`, `mcpTool`, `prompt` and `agent` entries, the `if`, `statusMessage`, `async`, `asyncRewake` and `shell` fields, and `hook_rewake`.
* The event table adds `PreSkillShellCommand`, `PreModelSwitch`, `TaskCompleted`, `TeammateIdle` and the elicitation events, and corrects where `hook_system_message` is honoured.
* The findings reference adds the `hook-field-dropped` and `hook-matcher-native-regex` notes.
