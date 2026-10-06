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

@test "run_monitor fails clearly for an unknown monitor or a target without monitors" {
	run --separate-stderr run_monitor claude nope
	[ "$status" -ne 0 ]
	[[ "$stderr" == *"run_monitor: no monitor nope"* ]]
	run --separate-stderr run_monitor copilot m
	[ "$status" -ne 0 ]
	[[ "$stderr" == *"run_monitor: copilot has no monitors"* ]]
}
