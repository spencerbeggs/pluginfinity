#!/usr/bin/env bats
# The dogfood plugin's monitors: Claude-only, so they are run from the Claude build.

load "$BATS_TEST_DIRNAME/../node_modules/pluginfinity/bats/pluginfinity.bash"

@test "the heartbeat notifies once and logs where it started" {
	run_monitor claude heartbeat --ticks 2 PLUGINFINITY_DEBUG=1 PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_HOST=claude
	assert_hook_exit 0
	[ "$output" = "pluginfinity-dogfood heartbeat: heartbeat is alive" ]
	grep -q "monitor/heartbeat.sh: env: PWD=" "$BATS_TEST_TMPDIR/state/pluginfinity/pluginfinity-dogfood/debug.log"
	grep -q "CLAUDE_PROJECT_DIR=$BATS_TEST_TMPDIR" "$BATS_TEST_TMPDIR/state/pluginfinity/pluginfinity-dogfood/debug.log"
}

@test "monitors.json holds both monitors, the skill-bound one with its when" {
	f="$BATS_TEST_DIRNAME/../builds/claude/monitors/monitors.json"
	jq -e '[.[] | select(.name == "heartbeat")][0] | (.when // "always") == "always"' "$f"
	jq -e '[.[] | select(.name == "skill-watch")][0].when == "on-skill-invoke:hook-eval"' "$f"
}

@test "the skill-bound monitor notifies once" {
	run_monitor claude skill-watch PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_HOST=claude
	assert_hook_exit 0
	[ "$output" = "pluginfinity-dogfood skill-watch: the hook-eval skill was invoked" ]
}

@test "copilot builds no monitors" {
	[ ! -e "$BATS_TEST_DIRNAME/../builds/copilot/monitors" ]
}

@test "the copilot-only file ships to copilot and not to claude" {
	[ -f "$BATS_TEST_DIRNAME/../builds/copilot/copilot-only/README.md" ]
	[ ! -e "$BATS_TEST_DIRNAME/../builds/claude/copilot-only" ]
}
