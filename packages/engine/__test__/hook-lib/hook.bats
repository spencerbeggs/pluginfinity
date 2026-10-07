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

@test "hook_input reads Copilot's path key as file_path" {
	make_plugin copilot
	hook_script 'hook_input tool_input.file_path'
	run_script "$FIXTURES/pretooluse.read.copilot.json"
	[ "$output" = "/tmp/x" ]
}

@test "hook_input reads Copilot's file_text key as content" {
	make_plugin copilot
	hook_script 'hook_input tool_input.content'
	run_script "$FIXTURES/pretooluse.write.copilot.json"
	[ "$output" = "hello" ]
}

@test "hook_input reads Copilot's old_str and new_str keys as old_string and new_string" {
	make_plugin copilot
	hook_script 'printf "%s|%s\n" "$(hook_input tool_input.old_string)" "$(hook_input tool_input.new_string)"'
	run_script "$FIXTURES/pretooluse.edit.copilot.json"
	[ "$output" = "a|b" ]
}

@test "hook_input still reads Claude's file_path key" {
	make_plugin claude
	hook_script 'hook_input tool_input.file_path'
	run_script "$FIXTURES/pretooluse.read.claude.json"
	[ "$output" = "/tmp/y" ]
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
	run_script '{"hook_event_name":"Stop"}' CLAUDE_PROJECT_DIR=/somewhere
	[ "$output" = "/somewhere" ]
}

@test "hook_project_dir walks up from cwd to the closest .git on copilot" {
	make_plugin copilot
	mkdir -p "$BATS_TEST_TMPDIR/repo/.git" "$BATS_TEST_TMPDIR/repo/a/b"
	hook_script 'hook_project_dir'
	run_script "{\"hook_event_name\":\"Stop\",\"cwd\":\"$BATS_TEST_TMPDIR/repo/a/b\"}"
	[ "$output" = "$BATS_TEST_TMPDIR/repo" ]
}

@test "hook_project_dir falls back to PWD when no .git is above the cwd or PWD" {
	make_plugin copilot
	mkdir -p "$BATS_TEST_TMPDIR/loose"
	hook_script 'cd "$BATS_TEST_TMPDIR/loose" && hook_project_dir'
	run_script "{\"hook_event_name\":\"Stop\",\"cwd\":\"$BATS_TEST_TMPDIR/loose\"}" BATS_TEST_TMPDIR="$BATS_TEST_TMPDIR"
	[ "$output" = "$BATS_TEST_TMPDIR/loose" ]
}

@test "hook_project_dir answers a non-git cwd on both hosts even with CLAUDE_PROJECT_DIR set" {
	local host
	for host in claude copilot; do
		make_plugin "$host"
		mkdir -p "$BATS_TEST_TMPDIR/loose/sub" "$BATS_TEST_TMPDIR/other"
		hook_script 'hook_project_dir'
		run_script "{\"hook_event_name\":\"Stop\",\"cwd\":\"$BATS_TEST_TMPDIR/loose/sub\"}" CLAUDE_PROJECT_DIR="$BATS_TEST_TMPDIR/other"
		[ "$output" = "$BATS_TEST_TMPDIR/loose/sub" ]
	done
}

@test "hook_project_dir on copilot with no cwd answers PWD and never walks to the repo root" {
	make_plugin copilot
	mkdir -p "$BATS_TEST_TMPDIR/repo/.git" "$BATS_TEST_TMPDIR/repo/a/b"
	hook_script 'cd "$BATS_TEST_TMPDIR/repo/a/b" && hook_project_dir'
	run_script '{"hook_event_name":"Stop"}' BATS_TEST_TMPDIR="$BATS_TEST_TMPDIR"
	[ "$output" = "$BATS_TEST_TMPDIR/repo/a/b" ]
}

@test "hook_project_dir terminates on a relative cwd" {
	make_plugin copilot
	mkdir -p "$BATS_TEST_TMPDIR/loose"
	hook_script 'cd "$BATS_TEST_TMPDIR/loose" && hook_project_dir'
	run_script '{"hook_event_name":"Stop","cwd":"rel/dir"}' BATS_TEST_TMPDIR="$BATS_TEST_TMPDIR"
	[ "$status" -eq 0 ]
	[ "$output" = "$BATS_TEST_TMPDIR/loose" ]
}

@test "hook_cd_project changes into the closest .git directory on copilot" {
	make_plugin copilot
	mkdir -p "$BATS_TEST_TMPDIR/repo/.git" "$BATS_TEST_TMPDIR/repo/sub"
	hook_script 'hook_cd_project; pwd -P'
	run_script "{\"hook_event_name\":\"Stop\",\"cwd\":\"$BATS_TEST_TMPDIR/repo/sub\"}"
	[ "$status" -eq 0 ]
	[ "$output" = "$(cd "$BATS_TEST_TMPDIR/repo" && pwd -P)" ]
}

@test "hook_cd_project changes into CLAUDE_PROJECT_DIR on claude" {
	make_plugin claude
	mkdir -p "$BATS_TEST_TMPDIR/proj"
	hook_script 'hook_cd_project; pwd -P'
	run_script '{"hook_event_name":"Stop"}' CLAUDE_PROJECT_DIR="$BATS_TEST_TMPDIR/proj"
	[ "$output" = "$(cd "$BATS_TEST_TMPDIR/proj" && pwd -P)" ]
}

@test "hook_cd_project ignores CDPATH and keeps stdout to the script's own output" {
	make_plugin claude
	mkdir -p "$BATS_TEST_TMPDIR/work/proj" "$BATS_TEST_TMPDIR/elsewhere/proj"
	hook_script 'cd "$WORK" && hook_cd_project; pwd -P'
	run_script '{"hook_event_name":"Stop"}' CLAUDE_PROJECT_DIR=proj WORK="$BATS_TEST_TMPDIR/work" CDPATH="$BATS_TEST_TMPDIR/elsewhere"
	[ "$status" -eq 0 ]
	[ "$output" = "$(cd "$BATS_TEST_TMPDIR/work/proj" && pwd -P)" ]
}

@test "hook_cd_project writes nothing to stdout and fails with a log when the cd fails" {
	make_plugin claude
	hook_script 'hook_cd_project || echo failed'
	run_script '{"hook_event_name":"Stop"}' CLAUDE_PROJECT_DIR="$BATS_TEST_TMPDIR/missing"
	[ "$output" = "failed" ]
	[[ "$(error_log)" == *"hook_cd_project"* ]]
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
	hook_script 'for e in UserPromptSubmit UserPromptExpansion PostToolUse PostToolBatch Stop SubagentStop ConfigChange PreCompact TaskCreated PreModelSwitch; do hook_supports block "$e" || echo "missing $e"; done
for e in SessionStart PreToolUse Notification PostToolUseFailure; do ! hook_supports block "$e" || echo "extra $e"; done
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

@test "hook_supports claude:system_message is false where Claude discards it" {
	make_plugin claude
	hook_script 'for e in Stop SessionStart UserPromptSubmit PreToolUse PostToolUse; do hook_supports system_message "$e" || echo "missing $e"; done
for e in Notification SessionEnd PreCompact ConfigChange; do ! hook_supports system_message "$e" || echo "extra $e"; done
echo done'
	run_script "$FIXTURES/stop.json"
	[ "$output" = "done" ]
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
	run_script '{"hook_event_name":"UserPromptSubmit","prompt":"hi"}' PLUGINFINITY_DEBUG=1
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
	hook_script 'hook_allow "" "{\"command\":\"ls\"}"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -c .hookSpecificOutput.updatedInput <<<"$output")" = '{"command":"ls"}' ]
	make_plugin copilot
	hook_script 'hook_allow "" "{\"command\":\"ls\"}"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -c .modifiedArgs <<<"$output")" = '{"command":"ls"}' ]
}

@test "hook_allow with invalid updated input under set -e logs and writes nothing" {
	make_plugin claude
	hook_script 'hook_allow "" "not json"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[ -z "$stderr" ]
	[[ "$(error_log)" == *"hook_allow"* ]]
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
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
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

@test "hook_fail_closed on Stop fails open when stop_hook_active is true" {
	make_plugin claude
	hook_script 'hook_fail_closed; false'
	run_script '{"hook_event_name":"Stop","stop_hook_active":true}'
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	run_script '{"hook_event_name":"SubagentStop","stop_hook_active":true}'
	[ -z "$output" ]
}

@test "hook_fail_closed keeps a response already sent" {
	make_plugin copilot
	hook_script 'hook_fail_closed; hook_allow; false'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$output" = '{"permissionDecision":"allow"}' ]
}

@test "invalid input JSON reads as an empty object, and hook_require_input fails open" {
	make_plugin copilot
	hook_script 'name=$(hook_input tool_name); echo "[$name]"'
	run_script 'not json'
	[ "$status" -eq 0 ]
	[ "$output" = "[]" ]
	hook_script 'hook_require_input; hook_deny "no"'
	run_script 'not json'
	[ "$status" -eq 0 ]
	[ "$output" = '{}' ]
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
	[[ "$(error_log my-plugin)" == *"[claude] hook/test.sh: boom"* ]]
}

@test "hook_debug writes nothing unless PLUGINFINITY_DEBUG=1" {
	make_plugin claude
	hook_script 'hook_debug "quiet"'
	run_script "$FIXTURES/stop.json"
	[ -z "$(debug_log)" ]
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[[ "$(debug_log)" == *"quiet"* ]]
}

@test "with debug on, the raw input is written to the debug log; with it off, nothing is" {
	make_plugin claude
	hook_script 'true'
	run_script "$FIXTURES/stop.json"
	[ -z "$(debug_log)" ]
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[[ "$(debug_log)" == *"input: {"* ]]
	[[ "$(debug_log)" == *'"hook_event_name":"Stop"'* ]]
}

@test "a large input with debug off is silent, even with SIGPIPE ignored" {
	make_plugin claude
	hook_script 'true'
	{
		printf '{"hook_event_name":"Stop","pad":"'
		head -c 1000000 /dev/zero | tr '\0' x
		printf '"}'
	} >"$BATS_TEST_TMPDIR/big.json"
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" \
		XDG_STATE_HOME="$BATS_TEST_TMPDIR/state" \
		bash -c 'trap "" PIPE; exec bash "$0"' "$PLUGIN/hooks/test.sh" <"$BATS_TEST_TMPDIR/big.json"
	[ "$status" -eq 0 ]
	[ -z "$stderr" ]
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

# --- debug outcome ---

@test "with debug on, hook_block logs its outcome and stdout is unchanged" {
	make_plugin claude
	hook_script 'hook_block "no"'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[ "$output" = '{"decision":"block","reason":"no"}' ]
	[[ "$(debug_log)" == *"outcome: block"* ]]
}

@test "with debug on, hook_noop logs outcome: noop" {
	make_plugin claude
	hook_script 'hook_noop'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[ "$output" = "{}" ]
	[[ "$(debug_log)" == *"outcome: noop"* ]]
}

@test "with debug on, each response helper names its outcome, in a fresh log per case" {
	make_plugin claude
	local log="$BATS_TEST_TMPDIR/state/pluginfinity/fixture/debug.log"
	hook_script 'hook_deny "x"'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_DEBUG=1
	[[ "$(debug_log)" == *"outcome: deny"* ]]
	rm -f "$log"
	hook_script 'hook_context "x"'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_DEBUG=1
	[[ "$(debug_log)" == *"outcome: context"* ]]
	[[ "$(debug_log)" != *"outcome: deny"* ]]
	rm -f "$log"
	hook_script 'hook_system_message "x"'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[[ "$(debug_log)" == *"outcome: system_message"* ]]
	[[ "$(debug_log)" != *"outcome: context"* ]]
	rm -f "$log"
	hook_script 'hook_raw claude "{\"a\":1}"'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[[ "$(debug_log)" == *"outcome: raw"* ]]
	[[ "$(debug_log)" != *"outcome: system_message"* ]]
}

@test "with debug on, hook_allow logs outcome: allow" {
	make_plugin claude
	hook_script 'hook_allow'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_DEBUG=1
	[ "$(jq -r .hookSpecificOutput.permissionDecision <<<"$output")" = "allow" ]
	[[ "$(debug_log)" == *"outcome: allow"* ]]
}

@test "with debug on, hook_ask logs outcome: ask" {
	make_plugin claude
	hook_script 'hook_ask "sure?"'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_DEBUG=1
	[ "$(jq -r .hookSpecificOutput.permissionDecision <<<"$output")" = "ask" ]
	[[ "$(debug_log)" == *"outcome: ask"* ]]
}

@test "with debug on, a second response is ignored and the first kind stays the outcome" {
	make_plugin claude
	hook_script 'hook_block "first"; hook_noop'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[ "$output" = '{"decision":"block","reason":"first"}' ]
	[[ "$(debug_log)" == *"outcome: block"* ]]
	[[ "$(debug_log)" != *"outcome: noop"* ]]
	[ "$(debug_log | grep -c 'outcome:')" -eq 1 ]
}

@test "with debug on, an unsupported helper logs outcome: noop" {
	make_plugin claude
	hook_script 'hook_deny "x"'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[ "$output" = "{}" ]
	[[ "$(debug_log)" == *"outcome: noop"* ]]
}

@test "with debug on, a hook that emits nothing logs outcome: none, exactly once" {
	make_plugin claude
	hook_script 'true'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[ -z "$output" ]
	[[ "$(debug_log)" == *"outcome: none"* ]]
	[ "$(debug_log | grep -c 'outcome:')" -eq 1 ]
}

@test "with debug on, a fail-closed crash logs the synthesised outcome and the exit code" {
	make_plugin claude
	hook_script 'hook_fail_closed
exit 7'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_DEBUG=1
	[ "$status" -eq 0 ]
	[[ "$output" == *'"permissionDecision":"deny"'* ]]
	[[ "$(debug_log)" == *"outcome: fail-closed deny (exit 7)"* ]]
}

@test "with debug on, a fail-closed crash outside PreToolUse logs fail-closed block" {
	make_plugin claude
	hook_script 'hook_fail_closed
exit 7'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[ "$status" -eq 0 ]
	[[ "$output" == *'"decision":"block"'* ]]
	[[ "$(debug_log)" == *"outcome: fail-closed block (exit 7)"* ]]
}

@test "with debug on, a fail-open crash logs outcome: none with the exit code" {
	make_plugin claude
	hook_script 'exit 3'
	run_script "$FIXTURES/stop.json" PLUGINFINITY_DEBUG=1
	[ -z "$output" ]
	[[ "$(debug_log)" == *"outcome: none (exit 3)"* ]]
}

@test "with debug off, no outcome is logged and stdout is unchanged" {
	make_plugin claude
	hook_script 'hook_block "no"'
	run_script "$FIXTURES/stop.json"
	[ "$output" = '{"decision":"block","reason":"no"}' ]
	[ -z "$(debug_log)" ]
}

@test "PLUGINFINITY_FAIL_CLOSED=1 makes a crashing PreToolUse hook deny" {
	make_plugin claude; hook_script 'false'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_FAIL_CLOSED=1
	[ "$status" -eq 0 ]
	[ "$(jq -r .hookSpecificOutput.permissionDecision <<<"$output")" = deny ]
}

# --- require input / event ---

@test "hook_require_input passes an object through" {
	make_plugin claude; hook_script 'hook_require_input; echo body'
	run_script "$FIXTURES/pretooluse.bash.json"; [ "$output" = body ]
}
@test "hook_require_input no-ops on an empty payload and logs it" {
	make_plugin claude; hook_script 'hook_require_input; echo body'
	run_script ''; [ "$output" = '{}' ]; [[ "$(error_log)" == *"malformed or empty JSON"* ]]
}
@test "hook_require_input no-ops on a JSON array" {
	make_plugin copilot; hook_script 'hook_require_input; echo body'
	run_script '[1,2]'; [ "$output" = '{}' ]
}
@test "hook_event answers from PLUGINFINITY_EVENT on Claude when the payload is garbage" {
	make_plugin claude; hook_script 'hook_event'
	run_script 'not json' PLUGINFINITY_EVENT=SessionStart; [ "$output" = SessionStart ]
}
@test "hook_event with no event anywhere prints nothing and returns 1" {
	make_plugin claude; hook_script 'hook_event || echo "rc=$?"'
	run_script 'not json'; [ "$output" = "rc=1" ]
}

# --- allow reason / project dirs ---

@test "hook_allow sends its reason on Claude" {
	make_plugin claude; hook_script 'hook_allow "safe: read-only"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -r .hookSpecificOutput.permissionDecisionReason <<<"$output")" = "safe: read-only" ]
}
@test "hook_allow sends reason and modifiedArgs on Copilot" {
	make_plugin copilot; hook_script 'hook_allow "ok" "{\"command\":\"ls\"}"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -c '[.permissionDecisionReason, .modifiedArgs.command]' <<<"$output")" = '["ok","ls"]' ]
}
@test "hook_allow with no reason omits the reason key" {
	make_plugin claude; hook_script 'hook_allow'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$(jq -c '.hookSpecificOutput | has("permissionDecisionReason")' <<<"$output")" = false ]
}
@test "hook_project_dir prefers a worktree cwd over CLAUDE_PROJECT_DIR" {
	make_plugin claude
	mkdir -p "$BATS_TEST_TMPDIR/main/.git" "$BATS_TEST_TMPDIR/wt/sub"; printf 'gitdir: x\n' >"$BATS_TEST_TMPDIR/wt/.git"
	hook_script 'printf "%s|%s\n" "$(hook_project_dir)" "$(hook_session_dir)"'
	run_script "{\"cwd\":\"$BATS_TEST_TMPDIR/wt/sub\",\"hook_event_name\":\"PreToolUse\"}" CLAUDE_PROJECT_DIR="$BATS_TEST_TMPDIR/main"
	[ "$output" = "$BATS_TEST_TMPDIR/wt|$BATS_TEST_TMPDIR/main" ]
}
@test "hook_project_dir falls back to CLAUDE_PROJECT_DIR when the input has no cwd" {
	make_plugin claude; mkdir -p "$BATS_TEST_TMPDIR/main/.git"; hook_script 'hook_project_dir'
	run_script '{"hook_event_name":"Stop"}' CLAUDE_PROJECT_DIR="$BATS_TEST_TMPDIR/main"
	[ "$output" = "$BATS_TEST_TMPDIR/main" ]
}

# --- envelope and relay ---

@test "hook_envelope claude renames Copilot's tool_input keys" {
	make_plugin copilot; hook_script 'hook_envelope claude | jq -c "[.hook_event_name, .tool_name, .tool_input.file_path, .tool_input.content]"'
	run_script "$FIXTURES/pretooluse.write.copilot.json" PLUGINFINITY_EVENT=PreToolUse
	[ "$output" = '["PreToolUse","Write","/tmp/x","hello"]' ]
}

@test "hook_envelope claude snake-cases a camelCase payload and parses toolArgs" {
	make_plugin copilot; hook_script 'hook_envelope claude | jq -c "[.session_id, .tool_input.command]"'
	run_script "$FIXTURES/pretooluse.camel.json" PLUGINFINITY_EVENT=PreToolUse
	[ "$output" = '["s-1","ls -la"]' ]
}

@test "hook_envelope on Claude keeps the input and an unknown target returns 1" {
	make_plugin claude; hook_script 'hook_envelope claude | jq -c "[.hook_event_name, .tool_name]"; hook_envelope nope || echo "rc=$?"'
	run_script "$FIXTURES/pretooluse.bash.json"
	[ "$output" = $'["PreToolUse","Bash"]\nrc=1' ]
}

@test "hook_relay maps a Claude deny onto Copilot's shape" {
	make_plugin copilot
	hook_script 'hook_relay "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"no\"}}"'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_EVENT=PreToolUse
	[ "$(jq -c '[.permissionDecision,.permissionDecisionReason]' <<<"$output")" = '["deny","no"]' ]
}

@test "hook_relay prefers the permission decision and logs the dropped context" {
	make_plugin claude
	hook_script 'hook_relay "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"additionalContext\":\"c\"}}"'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_DEBUG=1
	[ "$(jq -r .hookSpecificOutput.permissionDecision <<<"$output")" = allow ]
	[[ "$(debug_log)" == *"hook_relay dropped hookSpecificOutput.additionalContext"* ]]
}

@test "hook_relay of {} is a noop" {
	make_plugin claude; hook_script 'hook_relay "{}"'; run_script "$FIXTURES/pretooluse.bash.json"; [ "$output" = '{}' ]
}

@test "hook_relay of non-JSON emits nothing and returns 1" {
	make_plugin claude; hook_script 'hook_relay "oops" || echo "rc=$?"'
	run_script "$FIXTURES/pretooluse.bash.json"; [ "$output" = "rc=1" ]; [[ "$(error_log)" == *"not a JSON object"* ]]
}

@test "hook_relay of a block on Copilot's Stop blocks" {
	make_plugin copilot; hook_script 'hook_relay "{\"decision\":\"block\",\"reason\":\"keep going\"}"'
	run_script '{"hook_event_name":"Stop"}' PLUGINFINITY_EVENT=Stop
	[ "$(jq -r .decision <<<"$output")" = block ]
}

@test "hook_relay passes updatedInput to hook_allow and logs unmapped fields" {
	make_plugin claude
	hook_script 'hook_relay "{\"continue\":false,\"hookSpecificOutput\":{\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"ls\"}}}"'
	run_script "$FIXTURES/pretooluse.bash.json" PLUGINFINITY_DEBUG=1
	[ "$(jq -c .hookSpecificOutput.updatedInput <<<"$output")" = '{"command":"ls"}' ]
	[[ "$(debug_log)" == *"hook_relay dropped continue"* ]]
}

# --- tool names ---

@test "hook_tool_name spells an own MCP tool on Copilot" {
	make_plugin copilot silk "$(printf "_PF_TOOLS='Read=view'\n_PF_TOOLS_MCP='{server}-{tool}'\n_PF_TOOLS_SERVERS='savvy-mcp'\n_PF_TOOLS_UNLISTED=unresolved\n")"
	hook_script 'hook_tool_name mcp__plugin_silk_savvy-mcp__biome_check; hook_tool_name Read'
	run_script "$FIXTURES/sessionstart.startup.json"
	[ "$output" = "$(printf 'savvy-mcp-biome_check\nview')" ]
}

@test "hook_tool_name fails for another plugin's tool on Copilot" {
	make_plugin copilot silk "$(printf "_PF_TOOLS=''\n_PF_TOOLS_MCP='{server}-{tool}'\n_PF_TOOLS_SERVERS='savvy-mcp'\n_PF_TOOLS_UNLISTED=unresolved\n")"
	hook_script 'hook_tool_name mcp__plugin_other_x__y || echo "rc=$?"; hook_tool_name AskUserQuestion || echo "rc=$?"'
	run_script "$FIXTURES/sessionstart.startup.json"
	[ "$output" = "$(printf 'rc=1\nrc=1')" ]
}

@test "hook_tool_name echoes on Claude" {
	make_plugin claude silk "$(printf "_PF_TOOLS=''\n_PF_TOOLS_MCP='mcp__plugin_{plugin}_{server}__{tool}'\n_PF_TOOLS_SERVERS=''\n_PF_TOOLS_UNLISTED=keep\n")"
	hook_script 'hook_tool_name mcp__plugin_other_x__y'
	run_script "$FIXTURES/sessionstart.startup.json"
	[ "$output" = mcp__plugin_other_x__y ]
}

@test "hook_tool_name uses the Claude plugin name when tools.sh carries one" {
	make_plugin copilot renamed "$(printf "_PF_TOOLS=''\n_PF_TOOLS_PLUGIN='silk'\n_PF_TOOLS_MCP='{server}-{tool}'\n_PF_TOOLS_SERVERS='a b'\n_PF_TOOLS_UNLISTED=unresolved\n")"
	hook_script 'hook_tool_name mcp__plugin_silk_b__t'
	run_script "$FIXTURES/sessionstart.startup.json"
	[ "$output" = b-t ]
}

@test "hook_tool_name without tools.sh keeps the name" {
	make_plugin claude silk
	rm "$PLUGIN/hooks/lib/pluginfinity/tools.sh"
	hook_script 'hook_tool_name Whatever'
	run_script "$FIXTURES/sessionstart.startup.json"
	[ "$output" = Whatever ]
}

# --- matchers a host ignores ---

@test "a matcher passed by the build skips a non-matching SessionStart" {
	make_plugin copilot; hook_script 'echo ran'
	run_script '{"hook_event_name":"SessionStart","source":"resume"}' PLUGINFINITY_EVENT=SessionStart PLUGINFINITY_MATCHER=startup
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "an alternation matcher matches either word" {
	make_plugin copilot; hook_script 'echo ran'
	run_script '{"source":"resume"}' PLUGINFINITY_EVENT=SessionStart PLUGINFINITY_MATCHER='startup|resume'
	[ "$output" = ran ]
}

@test "a regex matcher is unanchored, as on Claude" {
	make_plugin copilot; hook_script 'echo ran'
	run_script '{"source":"resume"}' PLUGINFINITY_EVENT=SessionStart PLUGINFINITY_MATCHER='res.*'
	[ "$output" = ran ]
	run_script '{"source":"resume"}' PLUGINFINITY_EVENT=SessionStart PLUGINFINITY_MATCHER='^res.*'
	[ "$output" = ran ]
}

@test "an exact word does not match as a substring" {
	make_plugin copilot; hook_script 'echo ran'
	run_script '{"source":"startup-x"}' PLUGINFINITY_EVENT=SessionStart PLUGINFINITY_MATCHER=startup
	[ -z "$output" ]
}

@test "an empty or star matcher matches everything" {
	make_plugin copilot; hook_script 'echo ran'
	run_script '{"source":"resume"}' PLUGINFINITY_EVENT=SessionStart PLUGINFINITY_MATCHER='*'
	[ "$output" = ran ]
	run_script '{"source":"resume"}' PLUGINFINITY_EVENT=SessionStart PLUGINFINITY_MATCHER=
	[ "$output" = ran ]
}

@test "SessionEnd matches on reason and SubagentStop on agent_type" {
	make_plugin copilot; hook_script 'echo ran'
	run_script '{"reason":"logout"}' PLUGINFINITY_EVENT=SessionEnd PLUGINFINITY_MATCHER=clear
	[ -z "$output" ]
	run_script '{"reason":"clear"}' PLUGINFINITY_EVENT=SessionEnd PLUGINFINITY_MATCHER=clear
	[ "$output" = ran ]
	run_script '{"agent_type":"reviewer"}' PLUGINFINITY_EVENT=SubagentStop PLUGINFINITY_MATCHER=reviewer
	[ "$output" = ran ]
	run_script '{"agent_type":"other"}' PLUGINFINITY_EVENT=SubagentStop PLUGINFINITY_MATCHER=reviewer
	[ -z "$output" ]
}

@test "a non-matching matcher logs a debug line and a fail-closed hook still emits nothing" {
	make_plugin copilot; hook_script 'echo ran'
	run_script '{"source":"resume"}' PLUGINFINITY_EVENT=SessionStart PLUGINFINITY_MATCHER=startup PLUGINFINITY_FAIL_CLOSED=1 PLUGINFINITY_DEBUG=1
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	[[ "$(debug_log)" == *"matcher startup did not match resume"* ]]
}
