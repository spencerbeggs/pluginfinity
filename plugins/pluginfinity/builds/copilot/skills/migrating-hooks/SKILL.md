---
name: migrating-hooks
description: >-
  Use when a plugin still has a vendored hooks/lib, emit_* calls, hook_error or HOOK_LOG_PREFIX, a
  hand-written hooks.json, or separate Claude and Copilot hook scripts, and it is moving to pluginfinity
  and its hook library. Inventories the old plugin, maps every old helper, and verifies the result on
  both hosts.
---

# Migrating a plugin-bot-era plugin's hooks

A plugin from the plugin-bot era carries its own copy of the hook helpers, a hand-written `hooks.json`, and often one script per host. pluginfinity replaces all three: hooks are declared once in `pluginfinity.config.ts`, one script per hook runs on both hosts, and the library is written into each build. Migrate the hooks, then prove them on both hosts.

## Before you start

pluginfinity cannot yet build `mcpServers` (the build fails with NotImplemented), and it ships only `skills/`, `agents/` and `hooks/` plus files a hook names, so launcher scripts such as `bin/start-mcp.sh` are not shipped. If the plugin declares MCP or LSP servers, stop and report this before migrating; do not migrate hooks halfway.

## Inventory

Run these from the plugin root and write down what each finds. Every hit is something to migrate or delete.

```bash
ls hooks/lib
grep -rn 'emit_\|hook_error\|HOOK_LOG_PREFIX\|_HOOK_DEBUG\|source_session_env\|_gh' hooks
find . -name hooks.json -not -path '*/node_modules/*'
ls -d */ | grep -i copilot
grep -rn '\$(cat)\|<&0\|jq .*tool_input\|jq .*\.prompt' hooks
```

- `ls hooks/lib` lists the vendored helpers. Typical names are `hook-output.sh`, `hook-debug.sh`, `gh-wrapper.sh` and `source-session-env.sh`.
- The `grep` lists every call to an old helper. Each one needs a row in the Mapping table.
- The `find` lists each hand-written `hooks.json`. Every registration in it moves into the config.
- The `ls | grep` finds a per-host directory such as `copilot/`. Its scripts usually duplicate the Claude ones.
- The second `grep` finds direct stdin reads and raw `jq` on the payload. The library has already consumed stdin, so each needs `hook_input`.
- List the existing `.bats` files and their fixtures too. They move to `__test__/` and run against `builds/`.

## Mapping

Every old name and what replaces it. The library functions are the ones in `hook-authoring`. Consumer plugins copied and changed the templates, so the Notes column records each variant.

| Old | New | Notes |
| --- | --- | --- |
| `emit_noop` | `hook_noop` | The template printed `{}`. Some copies printed `{"continue":true,"suppressOutput":true}` or wrote it to fd 3. The library prints `{}` to stdout. |
| `emit_allow` | `hook_allow` | The template took an optional rewritten tool input. Some copies took a reason instead. `hook_allow` takes only the optional input JSON and auto-approves the call, so use `hook_noop` to let a call through. Drop the reason: `hook_allow` treats its argument as JSON, so a leftover reason logs "not JSON" and returns 1 with nothing emitted. If Claude should see the reason, emit it with `hook_context` in a separate hook, or leave it out, since a run sends one response. |
| `emit_deny` | `hook_deny` | Same `<reason>` argument. The library supplies a default reason when none is given. |
| `emit_context` | `hook_context <text>` | Was `emit_context <event> <text>`. Drop the event argument: the library takes it from the input, so the name always matches the firing event. On an event the host does not honour, such as Setup on Claude, which some old headers listed, `hook_context` answers `{}`. Check `hook_supports context <Event>` or the `hook-events` skill. |
| `emit_block` | `hook_block` | Not in the plugin-bot template. Consumers added it for a PostToolUse top-level `{"decision":"block"}`. `hook_block` prints the same shape wherever the host honours it. On Copilot it does nothing except on Stop and SubagentStop, so the old PostToolUse block does nothing there. |
| `emit_system_message` | `hook_system_message` | Does nothing on Copilot, which has no such field. On Claude it also answers `{}` for Notification, SessionEnd, PreCompact and ConfigChange, although vitest-agent documented `emit_system_message` for Stop, SessionEnd, PreCompact and SubagentStop. Check `hook_supports system_message <Event>`. Where the message is lost, use `hook_context` where `hook_supports context <Event>` allows it, or write a `hook_log` line. |
| `emit_raw` | `hook_raw <host> <json>` | The old function copied stdin to the response. The new one takes the host and the JSON as arguments and runs only on that host. Use it for a response only one host understands. |
| `emit_additional_context` | `hook_context` | The vitest-agent name for `emit_context`. Same change: drop the event argument. |
| `hook_error` | `hook_log` | Drop the hook-name argument. The library records the script name and the host itself. |
| `hook_debug` | `hook_debug` | Drop the hook-name argument. It now logs only when `PLUGINFINITY_HOOK_DEBUG=1`. |
| `HOOK_LOG_PREFIX` | none | Delete it, along with each `<PREFIX>_HOOK_DEBUG`, `<PREFIX>_HOOK_ERROR_LOG` and `<PREFIX>_HOOK_DEBUG_LOG`. Logs go to `$XDG_STATE_HOME/pluginfinity/<plugin>/`, and debugging is `PLUGINFINITY_HOOK_DEBUG=1`. |
| `source_session_env` | none | No equivalent; keep as a plugin script (Claude only). See the `plugin-scripts` skill for the session-env pattern. |
| `_gh` | none | No equivalent; keep as a plugin script. See the `plugin-scripts` skill for the `_gh` wrapper. |
| `_gh_auth_ok` | none | No equivalent; keep as a plugin script. See the `plugin-scripts` skill. |

The stdout fence, which moved fd 1 to stderr and wrote responses to fd 3, existed only in the vitest-agent and okfit variants, not in plugin-bot's template. It is gone. The library writes the response to stdout, so redirect the output of any CLI a hook spawns (`cmd >/dev/null`, or capture it with `$(...)`). A detached background worker must redirect too (`cmd >/dev/null 2>&1 &`), or it holds the host's stream open.

## Steps

1. Move each `hooks.json` registration into `hooks` in `pluginfinity.config.ts`. A matcher group with several handlers flattens into one entry per handler. A difference that exists only on Copilot becomes a `copilot: { hooks: … }` override, or disappears if the library already adapts it. See `../pluginfinity/references/hooks.md` for the entry shape.
2. Merge each pair of per-host scripts into one script that uses the library. Delete the host branches and every walk to `$CLAUDE_PROJECT_DIR`, and call `hook_project_dir` instead. `../hook-authoring/SKILL.md` has the script rules.
3. Delete the vendored `hooks/lib/`. A helper that is the plugin's own and not part of the old library (`okfit-cli.sh`, say) may stay under `hooks/lib/<plugin>/` or move to `scripts/lib/`. Only `hooks/lib/pluginfinity/` is reserved, for the generated library; never create it.
4. Replace every direct stdin read (`$(cat)`, `read`, `jq … <&0`) and every raw `jq` on the payload (for example `jq -r .tool_input.file_path`) with `hook_input <field>`. Raw `jq` also skips the Copilot key aliases.
5. Move fixtures to `__test__/fixtures/`.
6. Rewrite the tests to `load …/node_modules/pluginfinity/bats/pluginfinity.bash` and call `run_hook <target> …` against `builds/`, once per target.
7. Run `pluginfinity build`, then `bats --recursive __test__`, then `pluginfinity build --check`.

## Behaviour changes to check

- `exit 2` no longer blocks. The library makes every non-zero exit fail open, so replace each intentional block with `hook_deny` or `hook_block`.
- Any non-zero exit now fails open, including a Copilot preToolUse hook, where a bare non-zero exit would otherwise deny. Add `hook_fail_closed` only to a guard that must not fail open.
- Compare every `emit_noop` with `hook_noop`. A hook that depended on the `suppressOutput` variant now prints `{}`.
- A `script` entry is written in exec form on Claude, and as `bash "<root>/<script>"` on Copilot. A `command` entry stays shell form, written as the string you gave. Move any `cd` or `&&` logic into the script and use a `script` entry.
- The library reads stdin when it is sourced, so a hook that still reads stdin itself gets nothing. Use `hook_input` for every field; raw `jq` on the payload also skips the Copilot key aliases.
- A missing `jq` now makes the hook a silent no-op, so drop any "jq not found" context the old hook emitted.
- Delete old bats tests that assert on a hand-written `hooks.json`, since the build generates it, rather than rewriting them.
- Logs move to `$XDG_STATE_HOME/pluginfinity/<plugin>/hook-error.log` and `hook-debug.log`. Update any doc, test or support script that reads the old path.

## Done when

- No vendored library remains: the plugin's own helpers may stay under `hooks/lib/<plugin>/` or move to `scripts/lib/`, only `hooks/lib/pluginfinity/` is reserved for the generated library, and nothing calls `emit_*`, `hook_error` or `HOOK_LOG_PREFIX`.
- Every hook comes from `pluginfinity.config.ts`, and no `hooks.json` is hand-written.
- `bats --recursive __test__` passes on both targets.
- `pluginfinity build --check` is clean.
- A live check passes on both hosts. Use the `hook-eval` pattern from pluginfinity's dogfood plugin:
  1. Start a session with only the plugin loaded and `PLUGINFINITY_HOOK_DEBUG=1` set.
  2. Give each hook a marker string it reacts to, such as a command containing `pf-deny`.
  3. Trigger each marker, and record what the host did next to what you expected.
  4. Read the new lines in `hook-error.log` and `hook-debug.log`. Expect an `exited` line only from a hook you crash on purpose.
  5. Write the observed results to a report, for both hosts.
