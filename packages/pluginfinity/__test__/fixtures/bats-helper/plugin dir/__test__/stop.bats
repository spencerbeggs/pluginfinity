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
