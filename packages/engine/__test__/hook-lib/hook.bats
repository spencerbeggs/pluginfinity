#!/usr/bin/env bats
# The hook library's own contract, on both hosts.

load helpers

# --- sourcing ---

@test "sourcing the library writes nothing" {
	make_plugin claude
	hook_script 'true'
	run_script "$FIXTURES/sessionstart.startup.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[ -z "$stderr" ]
}

@test "without jq the hook is a silent no-op and logs why" {
	make_plugin copilot
	hook_script 'hook_deny "never"'
	run_script "$FIXTURES/pretooluse.bash.json" PATH="$(no_jq_path)"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[ -z "$stderr" ]
	[[ "$(error_log)" == *"jq not found"* ]]
}

# --- input ---

@test "hook_input reads a top-level and a nested Claude field" {
	make_plugin claude
	hook_script 'printf "%s|%s\n" "$(hook_input tool_name)" "$(hook_input tool_input.description)"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$output" = "Bash|wipe" ]
}

@test "hook_input with no field prints the whole input as JSON" {
	make_plugin claude
	hook_script 'hook_input | jq -r .tool_use_id'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$output" = "t-1" ]
}

@test "hook_input reads camelCase input by its Claude name, parsing a toolArgs string" {
	make_plugin copilot
	hook_script 'printf "%s|%s|%s\n" "$(hook_input tool_name)" "$(hook_input tool_input.command)" "$(hook_input session_id)"'
	run_script "$FIXTURES/pretooluse.camel.json"
	[ "$output" = "bash|ls -la|s-1" ]
}

@test "hook_input prints false, not nothing, for a false field" {
	make_plugin claude
	hook_script 'hook_input stop_hook_active'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "false" ]
}

@test "hook_input prints nothing for a missing field" {
	make_plugin claude
	hook_script 'printf "[%s]\n" "$(hook_input no_such_field)"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "[]" ]
}

# --- context ---

@test "hook_event comes from the input on claude" {
	make_plugin claude
	hook_script 'hook_event'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "Stop" ]
}

@test "hook_event prefers PLUGINFINITY_EVENT on copilot" {
	make_plugin copilot
	hook_script 'hook_event'
	run_script "$FIXTURES/pretooluse.camel.json" PLUGINFINITY_EVENT=PreToolUse
	[ "$output" = "PreToolUse" ]
}

@test "hook_host names the host from host.sh" {
	make_plugin copilot
	hook_script 'hook_host'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "copilot" ]
}

@test "hook_plugin_root is the build root, whatever the host sets" {
	make_plugin claude
	hook_script 'hook_plugin_root'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "$PLUGIN" ]
}

@test "hook_project_dir is CLAUDE_PROJECT_DIR on claude" {
	make_plugin claude
	hook_script 'hook_project_dir'
	run_script "$FIXTURES/stop.json" CLAUDE_PROJECT_DIR=/somewhere
	[ "$output" = "/somewhere" ]
}

@test "hook_project_dir walks up from cwd to the closest .git on copilot" {
	make_plugin copilot
	mkdir -p "$BATS_TEST_TMPDIR/repo/.git" "$BATS_TEST_TMPDIR/repo/a/b"
	hook_script 'hook_project_dir'
	run_script "{\"hook_event_name\":\"Stop\",\"cwd\":\"$BATS_TEST_TMPDIR/repo/a/b\"}"
	[ "$output" = "$BATS_TEST_TMPDIR/repo" ]
}

@test "hook_project_dir falls back to cwd when no .git is above it" {
	make_plugin copilot
	mkdir -p "$BATS_TEST_TMPDIR/loose"
	hook_script 'hook_project_dir'
	run_script "{\"hook_event_name\":\"Stop\",\"cwd\":\"$BATS_TEST_TMPDIR/loose\"}"
	[ "$output" = "$BATS_TEST_TMPDIR/loose" ]
}

@test "hook_project_dir terminates on a relative cwd" {
	make_plugin copilot
	hook_script 'hook_project_dir'
	run_script '{"hook_event_name":"Stop","cwd":"rel/dir"}'
	[ "$status" -eq 0 ]
	[ "$output" = "rel/dir" ]
}

@test "hook_supports: block on Stop is honoured on both hosts, on PostToolUse only on claude" {
	make_plugin copilot
	hook_script 'hook_supports block Stop && echo stop; hook_supports block PostToolUse || echo no-post'
	run_script "$FIXTURES/stop.json"
	[ "$output" = $'stop\nno-post' ]
}

@test "hook_supports claude:context lists" {
	make_plugin claude
	hook_script 'for e in SessionStart SubagentStart PostModelSwitch UserPromptSubmit UserPromptExpansion PreToolUse PostToolUse PostToolUseFailure PostToolBatch Stop SubagentStop; do hook_supports context "$e" || echo "missing $e"; done
for e in PreCompact Notification SessionEnd; do ! hook_supports context "$e" || echo "extra $e"; done
echo done'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "done" ]
}

@test "hook_supports claude:block lists" {
	make_plugin claude
	hook_script 'for e in UserPromptSubmit UserPromptExpansion PostToolUse PostToolUseFailure PostToolBatch Stop SubagentStop ConfigChange PreCompact TaskCreated PreModelSwitch; do hook_supports block "$e" || echo "missing $e"; done
for e in SessionStart PreToolUse Notification; do ! hook_supports block "$e" || echo "extra $e"; done
echo done'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "done" ]
}

@test "hook_supports copilot:context lists" {
	make_plugin copilot
	hook_script 'for e in SessionStart SubagentStart PostToolUse Notification; do hook_supports context "$e" || echo "missing $e"; done
for e in UserPromptSubmit Stop PreToolUse; do ! hook_supports context "$e" || echo "extra $e"; done
echo done'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "done" ]
}

@test "hook_supports copilot:block lists" {
	make_plugin copilot
	hook_script 'for e in Stop SubagentStop; do hook_supports block "$e" || echo "missing $e"; done
for e in PostToolUse PreToolUse UserPromptSubmit; do ! hook_supports block "$e" || echo "extra $e"; done
echo done'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "done" ]
}

@test "hook_supports deny, allow and ask only on PreToolUse, on both hosts" {
	for host in claude copilot; do
		make_plugin "$host"
		hook_script 'for c in deny allow ask; do hook_supports "$c" PreToolUse || echo "missing $c"; for e in PostToolUse Stop SessionStart; do ! hook_supports "$c" "$e" || echo "extra $c $e"; done; done
echo done'
		run_script "$FIXTURES/stop.json"
		[ "$output" = "done" ]
	done
}

@test "hook_supports system_message only on claude" {
	make_plugin claude
	hook_script 'hook_supports system_message Stop && echo yes'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "yes" ]
	make_plugin copilot
	hook_script 'hook_supports system_message Stop || echo no'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "no" ]
}

# --- output ---

@test "hook_context nests under hookSpecificOutput on claude" {
	make_plugin claude
	hook_script 'hook_context "hello"'
	run_script "$FIXTURES/sessionstart.startup.json"
	[ "$(jq -r .hookSpecificOutput.hookEventName <<<"$output")" = "SessionStart" ]
	[ "$(jq -r .hookSpecificOutput.additionalContext <<<"$output")" = "hello" ]
}

@test "hook_context is flat on copilot" {
	make_plugin copilot
	hook_script 'hook_context "hello"'
	run_script "$FIXTURES/sessionstart.startup.json"
	[ "$output" = '{"additionalContext":"hello"}' ]
}

@test "hook_context is a logged no-op on copilot UserPromptSubmit" {
	make_plugin copilot
	hook_script 'hook_context "lost"'
	run_script '{"hook_event_name":"UserPromptSubmit","prompt":"hi"}' PLUGINFINITY_HOOK_DEBUG=1
	[ "$output" = "{}" ]
	[[ "$(debug_log)" == *"hook_context does nothing on copilot for UserPromptSubmit"* ]]
}

@test "context text with quotes, newlines, backslashes and dollars survives" {
	make_plugin claude
	hook_script 'hook_context "$(hook_input tool_input.command)"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -r .hookSpecificOutput.additionalContext <<<"$output")" = "$(printf '%s\n%s' 'rm -rf "$HOME"; echo '"'"'quoted'"'"' c:\dir' next)" ]
}

@test "context text with quotes, newlines, backslashes and dollars survives on copilot" {
	make_plugin copilot
	hook_script 'hook_context "$(hook_input tool_input.command)"'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_EVENT=PostToolUse
	[ "$(jq -r .additionalContext <<<"$output")" = "$(printf '%s\n%s' 'rm -rf "$HOME"; echo '"'"'quoted'"'"' c:\dir' next)" ]
}

@test "hook_deny on claude" {
	make_plugin claude
	hook_script 'hook_deny "no"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$status" -eq 0 ]
	[ "$output" = '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"no"}}' ]
}

@test "hook_deny on copilot" {
	make_plugin copilot
	hook_script 'hook_deny "no"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$status" -eq 0 ]
	[ "$output" = '{"permissionDecision":"deny","permissionDecisionReason":"no"}' ]
}

@test "hook_deny without a reason names the plugin" {
	make_plugin copilot my-plugin
	hook_script 'hook_deny'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -r .permissionDecisionReason <<<"$output")" = "Blocked by my-plugin" ]
}

@test "hook_allow with updated input: updatedInput on claude, modifiedArgs on copilot" {
	make_plugin claude
	hook_script 'hook_allow "{\"command\":\"ls\"}"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -c .hookSpecificOutput.updatedInput <<<"$output")" = '{"command":"ls"}' ]
	make_plugin copilot
	hook_script 'hook_allow "{\"command\":\"ls\"}"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -c .modifiedArgs <<<"$output")" = '{"command":"ls"}' ]
}

@test "hook_ask on both hosts" {
	make_plugin claude
	hook_script 'hook_ask "sure?"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -r .hookSpecificOutput.permissionDecision <<<"$output")" = "ask" ]
	make_plugin copilot
	hook_script 'hook_ask "sure?"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -r .permissionDecision <<<"$output")" = "ask" ]
}

@test "hook_deny outside PreToolUse is a no-op" {
	make_plugin claude
	hook_script 'hook_deny "no"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "{}" ]
}

@test "hook_block on Stop is top-level decision on both hosts" {
	make_plugin claude
	hook_script 'hook_block "keep going"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = '{"decision":"block","reason":"keep going"}' ]
	make_plugin copilot
	hook_script 'hook_block "keep going"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = '{"decision":"block","reason":"keep going"}' ]
}

@test "hook_block on PostToolUse is a no-op on copilot" {
	make_plugin copilot
	hook_script 'hook_block "x"'
	run_script '{"hook_event_name":"PostToolUse","tool_name":"Bash"}'
	[ "$output" = "{}" ]
}

@test "hook_system_message on claude, no-op on copilot" {
	make_plugin claude
	hook_script 'hook_system_message "hi user"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = '{"systemMessage":"hi user"}' ]
	make_plugin copilot
	hook_script 'hook_system_message "hi user"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "{}" ]
}

@test "hook_noop prints an empty object" {
	make_plugin claude
	hook_script 'hook_noop'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "{}" ]
}

@test "hook_raw emits only on its host" {
	make_plugin claude
	hook_script 'hook_raw copilot "{\"x\":1}"; hook_raw claude "{\"y\": 2}"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = '{"y":2}' ]
}

@test "a second response is ignored" {
	make_plugin claude
	hook_script 'hook_block "first"; hook_block "second"'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_HOOK_DEBUG=1
	[ "$output" = '{"decision":"block","reason":"first"}' ]
	[[ "$(debug_log)" == *"ignored a second response"* ]]
}

# --- failure policy ---

@test "crash under set -e exits 0 with no output on copilot" {
	make_plugin copilot
	hook_script 'false'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[[ "$(error_log)" == *"exited 1"* ]]
}

@test "an unset variable under set -u fails open on claude" {
	make_plugin claude
	hook_script 'echo "$NOPE"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "an explicit exit 2 is treated as a failure, not a block" {
	make_plugin claude
	hook_script 'exit 2'
	run_script "$FIXTURES/stop.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "hook_fail_closed turns a PreToolUse crash into a deny" {
	make_plugin copilot
	hook_script 'hook_fail_closed; false'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$status" -eq 0 ]
	[ "$(jq -r .permissionDecision <<<"$output")" = "deny" ]
}

@test "hook_fail_closed turns a Stop crash into a block" {
	make_plugin claude
	hook_script 'hook_fail_closed; false'
	run_script "$FIXTURES/stop.json"
	[ "$(jq -r .decision <<<"$output")" = "block" ]
}

@test "hook_fail_closed keeps a response already sent" {
	make_plugin copilot
	hook_script 'hook_fail_closed; hook_allow; false'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$output" = '{"permissionDecision":"allow"}' ]
}

@test "invalid input JSON fails open" {
	make_plugin copilot
	# An assignment, so set -e sees the failure; a failing $(…) inside a
	# command's arguments would not abort the script.
	hook_script 'name=$(hook_input tool_name); hook_deny "$name"'
	run_script 'not json'
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[ -z "$stderr" ]
}

@test "a response from a subshell counts as the one response" {
	make_plugin claude
	hook_script '( hook_block "a" ); hook_block "b"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = '{"decision":"block","reason":"a"}' ]
}

@test "a response from a pipeline counts as the one response" {
	make_plugin claude
	hook_script 'echo x | while read -r l; do hook_block "a"; done; hook_block "b"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = '{"decision":"block","reason":"a"}' ]
}

@test "hook_fail_closed keeps a response sent from a subshell" {
	make_plugin claude
	hook_script 'hook_fail_closed; ( hook_block "a" ); false'
	run_script "$FIXTURES/stop.json"
	[ "$output" = '{"decision":"block","reason":"a"}' ]
}

@test "hook_raw with invalid JSON fails open and logs" {
	make_plugin claude
	hook_script 'hook_raw claude "not json"'
	run_script "$FIXTURES/stop.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[ -z "$stderr" ]
	[[ "$(error_log)" == *"hook_raw: not JSON"* ]]
}

@test "hook_raw with invalid JSON under hook_fail_closed denies on PreToolUse" {
	make_plugin copilot
	hook_script 'hook_fail_closed; hook_raw copilot "not json"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$status" -eq 0 ]
	[ "$(jq -r .permissionDecision <<<"$output")" = "deny" ]
}

@test "a missing host.sh exits 0 with no output" {
	make_plugin copilot
	rm "$PLUGIN/hooks/lib/pluginfinity/host.sh"
	hook_script 'hook_deny "x"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "the emitted marker file is removed on exit" {
	make_plugin claude
	hook_script 'hook_block "a"'
	mkdir -p "$BATS_TEST_TMPDIR/tmp"
	run_script "$FIXTURES/stop.json" TMPDIR="$BATS_TEST_TMPDIR/tmp"
	[ -z "$(ls "$BATS_TEST_TMPDIR/tmp")" ]
}

# --- logging ---

@test "hook_log writes the error log under the plugin's name" {
	make_plugin claude my-plugin
	hook_script 'hook_log "boom"'
	run_script "$FIXTURES/stop.json"
	[[ "$(error_log my-plugin)" == *"[claude] test.sh: boom"* ]]
}

@test "hook_debug writes nothing unless PLUGINFINITY_HOOK_DEBUG=1" {
	make_plugin claude
	hook_script 'hook_debug "quiet"'
	run_script "$FIXTURES/stop.json"
	[ -z "$(debug_log)" ]
	run_script "$FIXTURES/stop.json" PLUGINFINITY_HOOK_DEBUG=1
	[[ "$(debug_log)" == *"quiet"* ]]
}

# --- meta ---

@test "every public library function has a test" {
	local fn missing="" fns
	fns=$(grep -oE '^hook_[a-z_]+\(\)' "$LIB_SRC/hook.sh" | tr -d '()')
	[ -n "$fns" ]
	for fn in $fns; do
		grep -qw "$fn" "$BATS_TEST_FILENAME" || missing="$missing $fn"
	done
	[ -z "$missing" ] || { echo "untested:$missing"; false; }
}
