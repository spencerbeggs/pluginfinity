---
name: bash-hooks
description: >-
  Use when writing bash for a pluginfinity plugin: a hook script behind a `script` entry and its bats
  test, or a script outside hooks such as an MCP or LSP server launcher, a skill's scripts/ or anything
  that calls gh, git, aws, kubectl or another CLI. Walks the bats-first loop for a hook and the rules the
  hook library depends on, with tested recipes, and covers launchers, credentials, state, session env,
  logging and testing for the rest.
paths:
  - "**/hooks/**/*.sh"
  - "**/pluginfinity.config.ts"
  - "**/__test__/**/*.bats"
  - "**/skills/**/scripts/**"
  - "**/bin/start-*.sh"
---

# Bash hooks and scripts

Most of a plugin's bash is hooks, and most of this skill is about them. The rest is bash no hook entry runs, such as a server launcher or a script a skill tells the model to run; that is [scripts outside hooks](references/scripts.md), described below.

A `script` hook entry runs a bash script. pluginfinity builds the one script for both hosts: the hook library, sourced at the top of every script, adapts the input and the answer to each host, and the bats helper tests the script against `builds/<target>/`, so one test proves both.

This is the default way to write a hook. Two skills sit beside this one:

- [hook-events](../hook-events/SKILL.md) holds the contract: which event to use, what a hook receives on it and what each host does with each answer. Read it before you choose an event or rely on an answer. It is the same for a bash hook and a native one.
- [native-hooks](../native-hooks/SKILL.md) covers the other way to write a hook: a compiled program behind a `binary` entry.

## When to choose it

- Choose a bash hook when the logic is a few lines, when it mostly runs other commands, or when nobody working on the plugin will install Zig. It needs no build step of its own.
- Choose a native hook when the hook runs often enough for its start-up time to show (tens of milliseconds for bash and `jq`, about 2 for a native one), when the logic is awkward in bash, or when the user's machine may lack `jq`.
- A plugin can hold both. The entry, its `matcher`, `timeout`, `fallback` and `failClosed`, and the answers work the same way.

## The loop

1. Choose the event from the `hook-events` skill's table, and check what each host honours on it. `hook_supports <answer> <Event>` works only inside a sourced hook, so it is no use at authoring time.
2. Write a fixture in `__test__/fixtures/<event>.<scenario>.json`, with `hook_event_name` set, or use `hook_fixture`, which sets it. Without it the hook sees no event and answers `{}`, so a test can pass for the wrong reason.
3. Write a failing `@test` that calls `run_hook claude …` and `run_hook copilot …`.
4. Write the script in `hooks/`.
5. Add the entry under `hooks` in `pluginfinity.config.ts`.
6. Run `pluginfinity build`.
7. Run `bats --recursive __test__` and `pluginfinity build --check`.

## Rules

These prevent the mistakes that cost the most. What each function does exactly is in [the bash hook library](references/library.md).

- **Source the library first:** `. "$(dirname "$0")/lib/pluginfinity/hook.sh"`, with one `../` for each directory below `hooks/`. Then `set -euo pipefail`.
- **Call `hook_require_input` at the top level** when the script can do nothing without a payload. Empty or garbage stdin otherwise reads as `{}`. Never call it in a subshell: `exit` there ends only the subshell.
- **Read the event only through `hook_input`,** and assign it to a variable before you use it: `cmd=$(hook_input tool_input.command)`. The library has already consumed stdin, and a failing `$(...)` inside a `case` word does not trip `set -e`.
- **Only the answer may reach stdout.** Redirect any CLI the hook runs (`>/dev/null` or `>&2`), or capture it with `$(...)`.
- **Send one answer.** `hook_noop` lets a call proceed. `hook_allow` is only for approving or rewriting, and its arguments are `[reason] [updated-input-json]`, reason first.
- **Never `exit 2`, and never install your own `trap … EXIT`.** Refuse with `hook_deny` or `hook_block`; the library owns the trap that makes a crash fail open.
- **Call `hook_cd_project` before a CLI that finds its project from the working directory.** Copilot runs hooks from the plugin root, so without it the CLI finds the plugin. `hook_project_dir` is where this call runs; `hook_session_dir` is the session's project, which differs in a git worktree.
- **Fail closed only in a guard** that must not let a call through when it breaks: set `failClosed: true` on the entry. Context, reaction and stop hooks stay open.
- **Branch on what the host can do, never on the host.** `hook_supports <answer>` for an answer one host lacks, `hook_tool_name <claude-name>` for a tool's name, `hook_tool_prefix <server>` for one of the plugin's own MCP servers, `hook_has <kind> <name>` for a component one build leaves out. See [a capability one host lacks](references/recipes.md#a-capability-one-host-lacks).
- **A `matcher` on `SessionStart`, `SessionEnd` or `SubagentStop` is ignored by Copilot** and applied by the library, but only for a `script` entry that sources `hook.sh`. Write a `SessionStart` matcher in Claude Code's terms: the build widens `startup` to `startup|new` for Copilot. A regular expression it cannot widen gets a `hook-matcher-regex` note, and needs `new` added by hand.
- **Read a per-session value from the plugin's session env,** never from a file of your own or `CLAUDE_ENV_FILE`. A declared name is already a variable when the hook body starts; set one with `hook_env_set` from `SessionStart`. With `env` declared, give every `SessionStart` entry a `timeout` of 5 or more: a hook there may wait up to 3 seconds for the env runner.
- **To hand the decision to a CLI that prints a Claude-shaped response,** give it `hook_envelope claude` on stdin and pass what it prints to `hook_relay`, which picks one answer and applies each host's rules. Do not parse and re-emit the response yourself.
- **Log with `hook_log` and `hook_debug`,** never to a file of your own. Set `PLUGINFINITY_DEBUG=1` to see each hook's input and outcome, and read the logs with `pluginfinity logs`.
- **Never vendor the library, never write `hooks.json`, and never edit `builds/`.**
- **Keep `jq`, `cat`, `mktemp`, `rm`, `date`, `mkdir`, `basename`, `dirname` and `grep` reachable** in a test that narrows `PATH`; the library needs them. Write for bash 3.2, which macOS ships.

## Scripts outside hooks

The same plugin usually ships bash that no hook entry runs. Read [scripts outside hooks](references/scripts.md) before you write or change:

- **a server launcher** (`bin/start-*.sh`): it sources the server library, and one stray line on stdout breaks the protocol;
- **a script a skill runs** (`skills/<skill>/scripts/`): it does not inherit the plugin's variables, so it must be handed its paths;
- **any script, a hook included, that calls `gh`, `aws`, `kubectl` or another CLI**: an inherited `GH_TOKEN` beats the user's login, and the plugin never notices;
- **any script that keeps files between runs**: they go in the data directory, never the plugin root;
- **a test for one of these**: `run_script` and `run_monitor`, not `run_hook`.

A monitor script is covered by the `pluginfinity` skill's [monitors](../pluginfinity/references/monitors.md) reference.

## Where things live

```text
<plugin>/
  pluginfinity.config.ts                  the hooks entries
  hooks/<name>.sh                         source scripts
  __test__/<name>.bats                    bats tests
  __test__/fixtures/<event>.<scenario>.json
  builds/<target>/hooks/lib/pluginfinity/ generated: the library, never edited
```

## Recipes

- [Command guard](references/recipes.md#recipe-command-guard): deny a tool call before it runs.
- [Startup context](references/recipes.md#recipe-startup-context): add context when a session starts.
- [Post-edit reaction](references/recipes.md#recipe-post-edit-reaction): react to an edited file.
- [Stop gate](references/recipes.md#recipe-stop-gate): keep the agent working until a condition clears.
- [Subagent context](references/recipes.md#recipe-subagent-context): add context when a subagent starts.

## Reference

- [The bash hook library](references/library.md): read it for a function's exact behaviour: reading the event, each answer on each host, `hook_env_set`, and what the library does when a script fails.
- [Testing hooks with bats](references/testing.md): read it before you write a test: `run_hook`, the assertions, fixtures and the environment each host gives a hook.
- [Hook entries in the config](../pluginfinity/references/hooks.md): the entry's fields, how it is written for each host, the failure policy and what ships.
- [Session env](${CLAUDE_PLUGIN_ROOT}/skills/pluginfinity/references/session-env.md): declared variables, `hook_env_set`, and `run_hook --session-env` to seed a reader's values in a test.
- The `hook-events` skill: the contract for every event, and the JSON Schema of each event's input and output.
- [Scripts outside hooks](references/scripts.md): launchers, skill scripts, credentials, state, logging and their tests.
- The `persuasion` skill: how to word the text a hook gives the model.
