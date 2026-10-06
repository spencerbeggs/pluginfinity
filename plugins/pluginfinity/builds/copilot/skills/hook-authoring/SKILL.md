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
- Assign input to a variable before you use it: `cmd=$(hook_input tool_input.command)`.
- Read the event only through `hook_input`; the library has already consumed stdin.
- Call `hook_cd_project` before running a CLI that finds its project from the working directory. Copilot runs hooks from the plugin root, so without it the CLI finds the plugin, not the user's project.
- Only the response may reach stdout, and the library has no stdout fence. Redirect any CLI the hook runs (`>/dev/null` or `>&2`), or capture it with `$(...)`.
- Send one response per run.
- Never `exit 2`. Use `hook_deny` or `hook_block`.
- Never install your own `trap … EXIT`. The library owns it.
- Use `hook_noop` to let a call proceed. Use `hook_allow` only to auto-approve or rewrite.
- Call `hook_fail_closed` only in guards that must not fail open.
- Never vendor the library, never write `hooks.json`, and never edit `builds/`.
- Branching on `hook_supports` is the sanctioned way to handle a capability one host lacks, such as `if hook_supports block; then hook_block "…"; else hook_context "…"; fi`. Never branch on `hook_host` for that. See [a capability one host lacks](references/recipes.md#a-capability-one-host-lacks).
- The library needs `jq`, `cat`, `mktemp`, `rm`, `date`, `mkdir`, `basename` and `dirname` on `PATH`. Keep them reachable in a test that narrows `PATH`.

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
- The `hook-events` skill: which events each host fires and what each can do.
