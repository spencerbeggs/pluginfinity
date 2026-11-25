# Testing and debugging session env

Read this when you write a test for a hook or script that reads or sets a session value, or when a value is not what you expect at run time. The contract itself is in [session env](session-env.md).

## Testing

The bats helper reads and writes the library's own files under the test's state directory, so a test never
touches the user's sessions.

- **`--session-env <file>`** seeds the session's values as if `SessionStart` had run. The file holds
  `NAME=value` or `export NAME=value` lines, parsed and not sourced. `run_hook` seeds the fixture's
  `session_id`; `run_script` and `run_monitor` seed session `test-session` and point the project they run in at
  it (for a Claude Code script outside `skills/`, the project its `CLAUDE_PROJECT_DIR` names).
- **Seeds follow the run's state directory.** A call that passes its own `XDG_STATE_HOME` (a trailing
  `XDG_STATE_HOME=…` on `run_hook` or `run_monitor`, `--env XDG_STATE_HOME=…` on `run_script`, the last one
  winning) gets its seeded values, pointer and done marker there; otherwise they go under
  `$BATS_TEST_TMPDIR/state`.
- **An unseeded `SessionStart` hook does not wait.** `run_hook` writes the runner's done marker for the
  fixture's session, so the hook resolves live at once; pass `--env-wait` to keep the 3 second wait and test it.
- **`--env-file <file>`** on `run_script` puts a file's lines in the script's environment, as the exports a
  `SessionStart` hook wrote to `CLAUDE_ENV_FILE` are on Claude Code. They are ambient values (rung 5), not a
  session.
- **Nothing seeded** tests the live chain: defaults, then a `.env` you write into `$(_pf_project_dir)`.
- **The runner itself** runs like any hook, so a test can run it and then a reader, end to end. Pass
  `CLAUDE_ENV_FILE` on Claude Code to check what the model's shell would get.

From dogfood's `__test__/env.bats`:

```bash
setup() {
	printf 'PFDOG_COLOR=red\nexport PFDOG_SHAPE="triangle"\n' >"$BATS_TEST_TMPDIR/session.env"
}

@test "a reader hook puts a seeded session value into context, on both targets" {
	run_hook claude hooks/env-reader.sh posttooluse.env.json --session-env "$BATS_TEST_TMPDIR/session.env"
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood env: PFDOG_COLOR=red"
	run_hook copilot hooks/env-reader.sh posttooluse.env.json --session-env "$BATS_TEST_TMPDIR/session.env"
	assert_hook_json .additionalContext "pluginfinity-dogfood env: PFDOG_COLOR=red"
}

@test "a skill script takes the project's .env over the default" {
	local target project
	project=$(_pf_project_dir)
	printf 'PFDOG_LEVEL=7\n' >"$project/.env"
	for target in claude copilot; do
		run_script "$target" skills/env-probe/scripts/print-env.sh
		[ "$output" = $'PFDOG_COLOR=blue\nPFDOG_SHAPE=circle\nPFDOG_LEVEL=7' ]
	done
}
```

The runner, then a script, on both hosts:

```bash
@test "the setup script's values reach a skill script" {
	local target
	for target in claude copilot; do
		run_hook "$target" lib/pluginfinity/env-run.sh "$(hook_fixture SessionStart '{"source":"startup"}')" \
			CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/claude-env.sh"
		run_script "$target" skills/env-probe/scripts/print-env.sh
		[ "$output" = $'PFDOG_COLOR=green\nPFDOG_SHAPE=square\nPFDOG_LEVEL=1' ]
	done
	grep -qx "export PFDOG_COLOR='green'" "$BATS_TEST_TMPDIR/claude-env.sh"
}
```

## Debugging

Every problem is a line in `error.log` with the component and `env:`, never a failed hook. Read it with
`pluginfinity logs`, and `pluginfinity logs --debug` with `PLUGINFINITY_DEBUG=1` set for the reader's
`no session values; resolving live` lines and the setup script's stderr.

The files, under `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/`:

| Path | Holds |
| :-- | :-- |
| `session/<session id>/env` | One `NAME=value` line per declared name, the resolved value |
| `session/<session id>/set` | The names `hook_env_set` wrote |
| `session/<session id>/done` | Written when the runner has finished |
| `project/<key>` | The latest session id for one project, and the project's path |

An invalid session id (empty, `.`, holding `/`, `..`, a backslash or a control character) is logged and nothing is
read or written.
