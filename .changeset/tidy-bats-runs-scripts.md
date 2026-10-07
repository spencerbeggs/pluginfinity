---
"pluginfinity": minor
---

## Breaking Changes

* The bats helper follows the new hook contract: `hook_allow` takes `[reason] [updated-input-json]`, and Claude script hook entries run as `env K=V... bash <path>`. Update tests that assert on the old shapes; there is no compatibility shim.

## Features

* `defineConfig` accepts the `monitors` component and `failClosed` on hook entries.
* New bats helpers `run_script` and `run_monitor` run a built skill script or monitor the way the host does.
* `run_hook` applies the built entry's environment, takes `--matcher` and `VAR=value` overrides, and says on stderr when it guesses an entry.
* `run_script` takes `--cwd` and runs `skills/` paths from the project directory on both hosts.
* `run_monitor` starts in the project directory without the plugin variables Claude does not set and with `CLAUDE_CODE_SESSION_ID=test-session`.
