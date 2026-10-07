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

@test "a crashing PreToolUse hook fails open on Copilot's Read shape" {
	run_hook copilot hooks/crash.sh pretooluse.crash.copilot.json
	assert_hook_exit 0
	[ -z "$output" ]
	grep -q "exited 1" "$BATS_TEST_TMPDIR/state/pluginfinity/pluginfinity-dogfood/error.log"
}

@test "PostToolUse adds context after the marker command on both targets" {
	run_hook claude hooks/post-tool-use.sh posttooluse.context.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood saw pf-dogfood-context"
	run_hook copilot hooks/post-tool-use.sh posttooluse.context.json
	assert_hook_json .additionalContext "pluginfinity-dogfood saw pf-dogfood-context"
}

@test "Stop blocks once when the marker file exists" {
	mkdir -p "$BATS_TEST_TMPDIR/project/.git"
	touch "$BATS_TEST_TMPDIR/project/.pf-dogfood-block"
	run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":false}')"
	assert_hook_json .decision block
	run_hook copilot hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":false}')"
	assert_hook_json .decision block
	run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":false,"cwd":null}')"
	assert_hook_json .decision block
	run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":true}')"
	assert_hook_noop
}

@test "SubagentStart adds context on both targets" {
	run_hook claude hooks/subagent-start.sh subagentstart.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood subagent context"
	run_hook copilot hooks/subagent-start.sh subagentstart.json
	assert_hook_json .additionalContext "pluginfinity-dogfood subagent context"
}

@test "PostToolUse names the edited file on both targets and both input shapes" {
	run_hook claude hooks/post-edit.sh posttooluse.edit.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood saw an edit to /tmp/pf-dogfood-edit.txt"
	run_hook copilot hooks/post-edit.sh posttooluse.edit.copilot.json
	assert_hook_json .additionalContext "pluginfinity-dogfood saw an edit to /tmp/pf-dogfood-edit.txt"
}

@test "PreToolUse approves the allow marker with a reason on both targets" {
	run_hook claude hooks/pre-tool-use.sh "$(hook_fixture PreToolUse '{"tool_name":"Bash","tool_input":{"command":"echo pf-dogfood-allow"}}')"
	assert_hook_json .hookSpecificOutput.permissionDecision allow
	assert_hook_json .hookSpecificOutput.permissionDecisionReason "pluginfinity-dogfood approves commands holding pf-dogfood-allow"
	run_hook copilot hooks/pre-tool-use.sh "$(hook_fixture PreToolUse '{"tool_name":"Bash","tool_input":{"command":"echo pf-dogfood-allow"}}')"
	assert_hook_json .permissionDecision allow
}

@test "the PreToolUse entry is failClosed in both generated hook files" {
	jq -e '.hooks.PreToolUse[] | select(.matcher == "Bash") | .hooks[0] | .args | index("PLUGINFINITY_FAIL_CLOSED=1")' "$BATS_TEST_DIRNAME/../builds/claude/hooks/hooks.json"
	grep -q "PLUGINFINITY_FAIL_CLOSED" "$BATS_TEST_DIRNAME/../builds/copilot/com.github.copilot/hooks/hooks.json"
}

@test "a crash in the failClosed hook denies on both targets, as the built entry sets the variable" {
	local fx
	fx=$(hook_fixture PreToolUse '{"tool_name":"Bash","tool_input":{"command":"echo pf-dogfood-closed-crash"}}')
	run_hook claude hooks/pre-tool-use.sh "$fx"
	assert_hook_json .hookSpecificOutput.permissionDecision deny
	run_hook copilot hooks/pre-tool-use.sh "$fx"
	assert_hook_json .permissionDecision deny
	run_hook claude hooks/pre-tool-use.sh "$fx" PLUGINFINITY_FAIL_CLOSED=0
	assert_hook_exit 0
	[ -z "$output" ]
}

@test "every hook is a no-op on an empty payload" {
	local f
	for f in session-start user-prompt-submit pre-tool-use post-tool-use post-edit post-read stop subagent-start; do
		for t in claude copilot; do
			run_hook "$t" "hooks/$f.sh" /dev/null
			assert_hook_exit 0
			assert_hook_noop
		done
	done
	grep -q "malformed or empty JSON" "$BATS_TEST_TMPDIR/state/pluginfinity/pluginfinity-dogfood/error.log"
}

@test "SessionStart runs on a startup source and is skipped for another where Copilot ignores the matcher" {
	jq -e '[.hooks.SessionStart[] | select(.matcher == "startup")] | length == 1' "$BATS_TEST_DIRNAME/../builds/claude/hooks/hooks.json"
	local fx
	fx=$(hook_fixture SessionStart '{"source":"resume"}')
	run_hook copilot hooks/session-start.sh "$fx" PLUGINFINITY_MATCHER=startup
	assert_hook_exit 0
	[ -z "$output" ]
	run_hook copilot hooks/session-start.sh sessionstart.startup.json PLUGINFINITY_MATCHER=startup
	assert_hook_json .additionalContext "pluginfinity-dogfood is loaded on copilot (startup)"
}

@test "SessionStart runs on Copilot's new source: the built matcher is widened to startup|new" {
	local matcher fx
	matcher=$(jq -r '.hooks.SessionStart[] | select(.bash | contains("session-start.sh")) | .env.PLUGINFINITY_MATCHER' "$BATS_TEST_DIRNAME/../builds/copilot/com.github.copilot/hooks/hooks.json")
	[ "$matcher" = "startup|new" ]
	fx=$(hook_fixture SessionStart '{"source":"new"}')
	run_hook copilot hooks/session-start.sh "$fx" PLUGINFINITY_MATCHER="$matcher"
	assert_hook_json .additionalContext "pluginfinity-dogfood is loaded on copilot (new)"
	fx=$(hook_fixture SessionStart '{"source":"resume"}')
	run_hook copilot hooks/session-start.sh "$fx" PLUGINFINITY_MATCHER="$matcher"
	assert_hook_exit 0
	[ -z "$output" ]
}

@test "the Copilot hook file sets the matcher for the runtime to enforce" {
	grep -q "PLUGINFINITY_MATCHER" "$BATS_TEST_DIRNAME/../builds/copilot/com.github.copilot/hooks/hooks.json"
}

@test "hook_tool_name gives each host's name for Read" {
	local fx
	fx=$(hook_fixture PostToolUse '{"tool_name":"Read","tool_input":{"file_path":"/tmp/x"}}')
	run_hook claude hooks/post-read.sh "$fx"
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood: the Read tool is called Read on claude"
	run_hook copilot hooks/post-read.sh "$fx"
	assert_hook_json .additionalContext "pluginfinity-dogfood: the Read tool is called view on copilot"
}
