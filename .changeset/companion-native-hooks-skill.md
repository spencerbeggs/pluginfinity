---
"@pluginfinity/ai-plugins": minor
---

## Features

### Native hooks skill

A new `native-hooks` skill covers writing a hook as a compiled Zig program: setup, the write, test and build loop, the rules a native hook must keep, and a troubleshooting table. Its references hold the library's API, the Zig 0.17 spellings that differ from older Zig, and five tested recipes.

### Hook event schemas

The `hook-events` skill now ships a JSON Schema for the input and output of every Claude Code hook event, and for each built-in tool's `tool_input`, under `references/schemas/`. Each field carries a description, and a field Claude Code discards on an event is absent from that event's output schema.

### Skill authoring, agent authoring and persuasion skills

Three skills return from plugin-bot, rewritten for pluginfinity:

* `skill-authoring` covers writing a `SKILL.md`: the name and description rules, how a skill is triggered on each host, what belongs in the body and what in a reference, and what the Copilot build does with each field. It absorbs the old `skill-evals` skill as a reference on trigger and output evals, with a `trigger-harness.sh` script that runs a query set against Claude Code and reports how often the skill fired.
* `agent-authoring` covers writing `agents/<name>.md`: the description, the tools list, the skills preload, the system prompt and its boundaries section, the fields a plugin agent cannot use, and what the Copilot build keeps, translates or drops.
* `persuasion` covers the wording of text meant to change what an agent does: how much force to use, XML tags for text a hook injects, what each hook event can deliver on each host, and templates for `SessionStart`, `PreToolUse` and `PostToolUse`.

The `plugin-engineer` agent now preloads `persuasion`, and is told to read it on Copilot.

## Breaking Changes

### `hook-authoring` is now `bash-hooks`, and `plugin-scripts` and `migrating-hooks` are removed

The `hook-authoring` skill is renamed `bash-hooks` and reoriented as the companion to `native-hooks`: one covers a hook written as a bash script, the other a compiled one. Both point to `hook-events`, which now holds the contract they share and names each answer with its bash and native spelling.

The `plugin-scripts` skill is folded into `bash-hooks` as its `references/scripts.md`, and `native-hooks` gains a matching `references/system.md` for a compiled hook that runs another CLI or keeps state.

The `migrating-hooks` skill is removed. It converted plugin-bot-era hooks to the hook library.

To migrate, replace `/pluginfinity:hook-authoring` with `/pluginfinity:bash-hooks` wherever a prompt, agent or skill names it, replace `/pluginfinity:plugin-scripts` with `/pluginfinity:bash-hooks`, and drop any reference to `/pluginfinity:migrating-hooks`.

### Native hooks: a clean environment for a CLI, and state

The Zig hook library gains three calls, documented in the `native-hooks` skill:

* `h.execWith(argv, .{ .unset = …, .set = … })` runs a program with variables removed from, and added to, the hook's environment, so a stale `GH_TOKEN` in the user's shell cannot reach `gh`. It needs no shell and works on Windows.
* `h.writeFile(path, bytes)` writes a file whole, creating its directories.
* `h.dataDir()` is the plugin's data directory on the host.

## Documentation

* The hooks reference covers `binary`, `http`, `mcpTool`, `prompt` and `agent` entries, the `if`, `statusMessage`, `async`, `asyncRewake` and `shell` fields, and `hook_rewake`.
* The event table adds `PreSkillShellCommand`, `PreModelSwitch`, `TaskCompleted`, `TeammateIdle` and the elicitation events, and corrects where `hook_system_message` is honoured.
* The `pluginfinity` skill gains a Hooks section covering the handler kinds and a table routing to the six skills beside it. Its hooks reference documents how a `binary` entry is written and shipped and the `facts.json` a native hook reads, and its targets reference gains a per-host hooks table.
* The `pluginfinity` skill's hooks reference now holds the config only. The bash hook library and the bats helper moved to the `bash-hooks` skill as `references/library.md` and `references/testing.md`, beside the native library's `references/api.md` in `native-hooks`.
* The `pluginfinity` skill gains `references/servers.md` and `references/logging.md`, and session env's testing and migrating sections become pages of their own. Session env now documents `h.env` and `h.envSet` for a native hook.
* The `plugin-engineer` agent gains a loop for native hooks, and the `hook-events` per-event notes no longer assume a bash hook.
* The findings reference adds the `hook-field-dropped` and `hook-matcher-native-regex` notes.
