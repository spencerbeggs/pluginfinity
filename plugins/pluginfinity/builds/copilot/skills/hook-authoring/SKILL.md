---
name: hook-authoring
description: "Use when adding or changing a hook in a pluginfinity plugin: a hook entry in pluginfinity.config.ts, a script under hooks/, or its bats test under __test__/. Walks the bats-first loop (fixture, failing run_hook test on both targets, script, config entry, build, bats) and the script rules the hook library depends on. Applies to files matching: **/hooks/**/*.sh, **/pluginfinity.config.ts, **/__test__/**/*.bats"
---

# Writing a hook

pluginfinity builds one hook script for both hosts. The hook library, sourced at the top of every script, adapts input and output to each host. The bats helper then tests the script against `builds/<target>/`, so one test proves both hosts.

## The loop

1. Choose the event. Check what it can do on each host in the `hook-events` skill's table. `hook_supports <capability> <Event>` works only inside a sourced hook, so it is no use at authoring time.
2. Write a fixture in `__test__/fixtures/<event>.<scenario>.json`, with `hook_event_name` set, or use `hook_fixture`, which sets it. Without it the hook sees no event and answers `{}`, so a test can pass for the wrong reason.
3. Write a failing `@test` that calls `run_hook claude …` and `run_hook copilot …`.
4. Write the script in `hooks/`.
5. Add the entry under `hooks` in `pluginfinity.config.ts`.
6. Run `pluginfinity build`.
7. Run `bats --recursive __test__` and `pluginfinity build --check`.

## Script rules

- Source the library with `. "$(dirname "$0")/lib/pluginfinity/hook.sh"`. Add `../` for each directory depth below `hooks/`.
- Start with `set -euo pipefail`.
- Call `hook_require_input` at the top level, right after sourcing, when the script cannot do anything useful without a JSON payload. Empty or garbage stdin otherwise reads as `{}`. `exit` inside a subshell ends only the subshell, so never call it there.
- Assign input to a variable before you use it: `cmd=$(hook_input tool_input.command)`.
- Read the event only through `hook_input`; the library has already consumed stdin.
- Call `hook_cd_project` before running a CLI that finds its project from the working directory. Copilot runs hooks from the plugin root, so without it the CLI finds the plugin, not the user's project.
- Only the response may reach stdout, and the library has no stdout fence. Redirect any CLI the hook runs (`>/dev/null` or `>&2`), or capture it with `$(...)`.
- Send one response per run.
- Never `exit 2`. Use `hook_deny` or `hook_block`.
- Never install your own `trap … EXIT`. The library owns it.
- Use `hook_noop` to let a call proceed. Use `hook_allow` only to auto-approve or rewrite. Its arguments are `[reason] [updated-input-json]`, reason first: `hook_allow "" '{"command":"ls"}'` rewrites with no reason. A script written for the older `hook_allow '<json>'` now sends the JSON as the reason.
- Fail closed only in guards that must not let a call through when they break. Set `failClosed: true` on the entry in `pluginfinity.config.ts`, which holds even if the script dies before it reaches a call, or call `hook_fail_closed` early. Context, reaction and stop hooks stay open.
- `hook_project_dir` is where this call runs, and it is never empty: an absolute input `cwd` walked up to its git root, else that `cwd`; with no `cwd`, `CLAUDE_PROJECT_DIR` on Claude Code, else `$PWD` (walked up to `.git` on Claude Code only). `hook_session_dir` is the session's project, which in a git worktree is not the same. Use `hook_cd_project` for the first.
- `hook_tool_name <claude-name>` prints the host's run-time spelling of a tool, such as `view` for `Read` on Copilot, and returns 1 when the host has none. Branch on its status, not on the host. `hook_tool_prefix <server>` prints the run-time prefix of one of this plugin's own MCP servers (`mcp__plugin_<plugin>_<server>__` on Claude Code, `<server>-` on Copilot) and returns 1 for a server the plugin does not declare.
- `hook_has <monitor|skill|agent|server> <name>` succeeds when this host's build ships the component, so a hook can name a skill or monitor only where it exists. Branch on its status, not on the host.
- To hand the decision to a CLI that prints a Claude-shaped response, give it `hook_envelope claude` on stdin and pass its output to `hook_relay`. `hook_relay` picks one answer (permission decision, then block, then context, then system message, then noop), calls the matching helper so each host's rules apply, and logs dropped fields to the debug log.
- A `matcher` on `SessionStart`, `SessionEnd` or `SubagentStop` is ignored by Copilot, and the library enforces it at run time, but only for a `script` entry that sources `hook.sh`. A `command` entry gets the build note without the enforcement.
- Write a `SessionStart` matcher in Claude Code's terms. Copilot calls a fresh session `new`, so its build widens `startup` to `startup|new` (`hook-matcher-widened`); a regex it cannot widen gets `hook-matcher-regex`, and needs `new` added by hand.
- Read a value decided once per session, such as a package manager, from the plugin's session env, not from a file of your own. When the config declares `env`, every declared name is already a variable when the hook body starts. Set one with `hook_env_set NAME value` from `SessionStart` (or Claude Code's `Setup`, `CwdChanged` and `FileChanged`); it always returns 0 and logs a refusal. Never write `CLAUDE_ENV_FILE` yourself. See session env (the `pluginfinity` skill's `references/session-env.md`).
- With `env` declared, give every `SessionStart` entry a `timeout` of 5 or more: a `SessionStart` hook may wait up to 3 seconds for the env runner, and a shorter timeout gets an `env-wait-timeout` note.
- Never vendor the library, never write `hooks.json`, and never edit `builds/`.
- Branching on `hook_supports` is the sanctioned way to handle a capability one host lacks, such as `if hook_supports block; then hook_block "…"; else hook_context "…"; fi`. Never branch on `hook_host` for that. See [a capability one host lacks](references/recipes.md#a-capability-one-host-lacks).
- Log with `hook_log` (always, to `error.log`) and `hook_debug` (to `debug.log` when `PLUGINFINITY_DEBUG=1`). `PLUGINFINITY_DEBUG=1` is the one switch for hooks, servers, monitors and skill scripts. Read the logs with `pluginfinity logs` (`--debug` for `debug.log`, `--follow` to watch a live session).
- The library needs `jq`, `cat`, `mktemp`, `rm`, `date`, `mkdir`, `basename`, `dirname` and `grep` on `PATH`. Keep them reachable in a test that narrows `PATH`.

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

- [Hooks reference](../pluginfinity/references/hooks.md): the API, the per-host table, the failure policy and the testing helper.
- Session env (the `pluginfinity` skill's `references/session-env.md`): declared variables, `hook_env_set`, and `run_hook --session-env` to seed a reader's values in a test.
- The `hook-events` skill: which events each host fires and what each can do.
