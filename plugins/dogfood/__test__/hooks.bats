#!/usr/bin/env bats
# The dogfood plugin's hooks, run from both builds through pluginfinity's helper.

load "$BATS_TEST_DIRNAME/../node_modules/pluginfinity/bats/pluginfinity.bash"

@test "SessionStart adds context naming the host, on both targets" {
	run_hook claude hooks/session-start.sh sessionstart.startup.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood is loaded on claude (startup)"
	run_hook copilot hooks/session-start.sh sessionstart.startup.json
	assert_hook_json .additionalContext "pluginfinity-dogfood is loaded on copilot (startup)"
}

@test "UserPromptSubmit shows a system message on claude and does nothing on copilot" {
	run_hook claude hooks/user-prompt-submit.sh userpromptsubmit.system.json
	assert_hook_json .systemMessage "pluginfinity-dogfood saw the marker"
	run_hook copilot hooks/user-prompt-submit.sh userpromptsubmit.system.json
	assert_hook_noop
}

@test "PreToolUse denies the marker command on both targets" {
	run_hook claude hooks/pre-tool-use.sh pretooluse.deny.json
	assert_hook_json .hookSpecificOutput.permissionDecision deny
	run_hook copilot hooks/pre-tool-use.sh pretooluse.deny.json
	assert_hook_json .permissionDecision deny
}

@test "PreToolUse lets other commands through" {
	run_hook claude hooks/pre-tool-use.sh pretooluse.allow.json
	assert_hook_noop
	run_hook copilot hooks/pre-tool-use.sh pretooluse.allow.json
	assert_hook_noop
}

@test "a crashing PreToolUse hook fails open on both targets" {
	run_hook claude hooks/crash.sh pretooluse.crash.json
	assert_hook_exit 0
	[ -z "$output" ]
	run_hook copilot hooks/crash.sh pretooluse.crash.json
	assert_hook_exit 0
	[ -z "$output" ]
}

@test "PostToolUse adds context after the marker command on both targets" {
	run_hook claude hooks/post-tool-use.sh posttooluse.context.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood saw pf-dogfood-context"
	run_hook copilot hooks/post-tool-use.sh posttooluse.context.json
	assert_hook_json .additionalContext "pluginfinity-dogfood saw pf-dogfood-context"
}

@test "Stop blocks once when the marker file exists" {
	mkdir -p "$BATS_TEST_TMPDIR/proj/.git"
	touch "$BATS_TEST_TMPDIR/proj/.pf-dogfood-block"
	HOOK_PROJECT_DIR="$BATS_TEST_TMPDIR/proj" run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":false}')"
	assert_hook_json .decision block
	run_hook copilot hooks/stop.sh "$(hook_fixture Stop "{\"stop_hook_active\":false,\"cwd\":\"$BATS_TEST_TMPDIR/proj\"}")"
	assert_hook_json .decision block
	HOOK_PROJECT_DIR="$BATS_TEST_TMPDIR/proj" run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":true}')"
	assert_hook_noop
}

@test "SubagentStart adds context on both targets" {
	run_hook claude hooks/subagent-start.sh subagentstart.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood subagent context"
	run_hook copilot hooks/subagent-start.sh subagentstart.json
	assert_hook_json .additionalContext "pluginfinity-dogfood subagent context"
}
