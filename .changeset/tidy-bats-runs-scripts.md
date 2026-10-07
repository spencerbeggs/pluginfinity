---
"pluginfinity": minor
---

## Breaking Changes

* The bats helper follows the new hook contract: `hook_allow` takes `[reason] [updated-input-json]`, and Claude script hook entries run as `env K=V... bash <path>`. Update tests that assert on the old shapes; there is no compatibility shim.
* `run_hook` runs the script with the environment of the built entry that registers it, and fails when no entry runs the script (use `run_script` for an unregistered one). It takes `--matcher` (read from `env.PLUGINFINITY_MATCHER` on Copilot's `SessionStart`, `SessionEnd` and `SubagentStop` entries) and `VAR=value` overrides, and says on stderr when it guesses an entry.
* `run_script` takes `--env VAR=value` (repeatable) in place of a trailing `-- VAR=value...`; a bare `--` and every later argument now reach the script.
* One test project, `$BATS_TEST_TMPDIR/project`, is the default for `hook_fixture`'s `cwd`, `HOOK_PROJECT_DIR` (so `CLAUDE_PROJECT_DIR` for `run_hook` and for skill scripts on Claude), a skill script's directory and `run_monitor`'s. It was `$BATS_TEST_TMPDIR` itself for hooks.
* `run_script` gives a `skills/` script the environment the agent's Bash tool gives one: on Claude Code `CLAUDE_CODE_SESSION_ID=test-session` and no `CLAUDE_PLUGIN_ROOT` or `CLAUDE_PROJECT_DIR` (`HOOK_PROJECT_DIR` no longer reaches it), on Copilot no `PLUGIN_ROOT`. A launcher keeps the plugin variables. Update tests that read the plugin variables in a skill script.
* `run_monitor` for a missing monitor now sets `$status` to 1.

## Features

* `defineConfig` accepts the `monitors` component and `failClosed` on hook entries.
* New bats helpers `run_script` and `run_monitor` run a built skill script or monitor the way the host does.
* `run_script` takes `--cwd` and runs `skills/` paths from the project directory on both hosts.
* `run_script --env-file <file>` adds a file's `NAME=value` or `export NAME=value` lines to a script's environment, parsed and not sourced, to model `CLAUDE_ENV_FILE` exports.
* `run_monitor` starts in the project directory without the plugin variables Claude does not set and with `CLAUDE_CODE_SESSION_ID=test-session`.
