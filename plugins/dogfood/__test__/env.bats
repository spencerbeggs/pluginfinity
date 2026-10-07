#!/usr/bin/env bats
# The dogfood plugin's session env, run from both builds through pluginfinity's helper.

load "$BATS_TEST_DIRNAME/../node_modules/pluginfinity/bats/pluginfinity.bash"

setup() {
	printf 'PFDOG_COLOR=red\nexport PFDOG_SHAPE="triangle"\n' >"$BATS_TEST_TMPDIR/session.env"
}

@test "a reader hook puts a seeded session value into context, on both targets" {
	run_hook claude hooks/env-reader.sh posttooluse.env.json --session-env "$BATS_TEST_TMPDIR/session.env"
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood env: PFDOG_COLOR=red"
	run_hook copilot hooks/env-reader.sh posttooluse.env.json --session-env "$BATS_TEST_TMPDIR/session.env"
	assert_hook_json .additionalContext "pluginfinity-dogfood env: PFDOG_COLOR=red"
}

@test "a reader hook with no session values uses the config default on both targets" {
	run_hook claude hooks/env-reader.sh posttooluse.env.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood env: PFDOG_COLOR=blue"
	run_hook copilot hooks/env-reader.sh posttooluse.env.json
	assert_hook_json .additionalContext "pluginfinity-dogfood env: PFDOG_COLOR=blue"
}

@test "the reader hook stays quiet for other patterns" {
	run_hook claude hooks/env-reader.sh posttooluse.context.json
	assert_hook_noop
}

@test "a skill script sees the seeded session values through the project pointer, on both targets" {
	local target
	for target in claude copilot; do
		run_script "$target" skills/env-probe/scripts/print-env.sh --session-env "$BATS_TEST_TMPDIR/session.env"
		assert_hook_exit 0
		[ "$output" = $'PFDOG_COLOR=red\nPFDOG_SHAPE=triangle\nPFDOG_LEVEL=1' ]
		[ -z "$stderr" ]
	done
}

@test "a skill script with no session resolves the defaults live, on both targets" {
	local target
	for target in claude copilot; do
		run_script "$target" skills/env-probe/scripts/print-env.sh
		[ "$output" = $'PFDOG_COLOR=blue\nPFDOG_SHAPE=circle\nPFDOG_LEVEL=1' ]
	done
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
