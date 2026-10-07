#!/usr/bin/env bats
load "$PLUGINFINITY_BATS_HELPER"

@test "run_hook works from a plugin dir with a space, on both targets" {
	for target in claude copilot; do
		run_hook "$target" hooks/stop.sh stop.json
		assert_hook_exit 0
		assert_hook_json .decision block
		assert_hook_json .reason "stop on $target"
	done
}

@test "hook_fixture builds a Claude-shaped input" {
	run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":true}')"
	assert_hook_noop
}

@test "run_script runs a skill script with stdin closed, on both targets" {
	for target in claude copilot; do
		run_script "$target" skills/s/scripts/cat.sh
		[ "$status" -eq 0 ]
		[ "$output" = done ]
	done
}

@test "run_script feeds --stdin to the script" {
	printf 'piped\n' >"$BATS_TEST_TMPDIR/in.txt"
	run_script claude skills/s/scripts/cat.sh --stdin "$BATS_TEST_TMPDIR/in.txt"
	[ "$status" -eq 0 ]
	[ "$output" = "$(printf 'piped\ndone')" ]
}

@test "run_monitor prints the first notification" {
	run_monitor claude m
	[ "$status" -eq 0 ]
	[ "$output" = "first hello" ]
	run_monitor claude m --ticks 2 GREETING=there
	[ "$output" = "$(printf 'first there\nfirst there')" ]
}

@test "run_monitor fails clearly for an unknown monitor" {
	run --separate-stderr run_monitor claude nope
	[ "$status" -ne 0 ]
	[[ "$stderr" == *"run_monitor: no monitor nope"* ]]
}

@test "run_hook applies fail-closed from the entry, so a crash denies, on both targets" {
	run_hook claude hooks/crash.sh "$(hook_fixture PreToolUse '{"tool_name":"Bash"}')"
	assert_hook_json .hookSpecificOutput.permissionDecision deny
	run_hook copilot hooks/crash.sh "$(hook_fixture PreToolUse '{"tool_name":"Bash"}')"
	assert_hook_json .permissionDecision deny
}

@test "run_hook gives Claude PLUGINFINITY_EVENT from the entry, not the payload" {
	run_hook claude hooks/envhook.sh "$(hook_fixture Bogus)" --matcher Read
	[[ "$stderr" == "PreToolUse||read-b" ]]
}

@test "run_hook --matcher picks between entries for one script" {
	run_hook claude hooks/envhook.sh "$(hook_fixture PreToolUse)" --matcher Bash
	[[ "$stderr" == "PreToolUse|1|bash-a" ]]
	run_hook copilot hooks/envhook.sh "$(hook_fixture PreToolUse)" --matcher Read
	[[ "$stderr" == "PreToolUse||read-b" ]]
}

@test "run_hook warns and uses the first entry without --matcher" {
	run --separate-stderr run_hook copilot hooks/envhook.sh "$(hook_fixture PreToolUse)"
	[[ "$stderr" == *"run_hook: 2 entries run hooks/envhook.sh; using the first (pass --matcher)"* ]]
}

@test "run_hook fails when --matcher matches no entry" {
	run --separate-stderr run_hook claude hooks/envhook.sh "$(hook_fixture PreToolUse)" --matcher Nope
	[ "$status" -ne 0 ]
	[[ "$stderr" == *"matcher 'Nope'"* ]]
}

@test "run_hook lets an explicit VAR=value override the entry's environment" {
	for target in claude copilot; do
		run_hook "$target" hooks/envhook.sh "$(hook_fixture PreToolUse)" --matcher Bash PLUGINFINITY_FAIL_CLOSED=0 EXTRA=mine
		[[ "$stderr" == "PreToolUse|0|mine" ]]
	done
}

@test "run_script runs a skill script from the project dir on both targets" {
	for target in claude copilot; do
		run_script "$target" skills/s/scripts/show.sh a=b -- FOO=1
		[ "$status" -eq 0 ]
		[ "$output" = "pwd=$BATS_TEST_TMPDIR/project foo=1 args=a=b" ]
	done
	run_script copilot skills/s/scripts/show.sh --cwd "$BATS_TEST_TMPDIR"
	[ "$output" = "pwd=$BATS_TEST_TMPDIR foo= args=" ]
}

@test "run_script keeps the plugin root as cwd on Copilot for a server launcher" {
	run_script copilot servers/show.sh
	[ "$output" = "pwd=$PLUGIN_DIR/builds/copilot foo= args=" ]
}

@test "run_monitor starts in the project dir without Claude's hook variables" {
	run_monitor claude show --ticks 3
	[ "$status" -eq 0 ]
	[ "$output" = "pwd=$BATS_TEST_TMPDIR/project project=unset root=unset plugin=unset session=test-session ticks=3" ]
}

@test "run_monitor on a target without monitors fails with status 1" {
	run_monitor copilot x
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"run_monitor: copilot has no monitors"* ]]
}
