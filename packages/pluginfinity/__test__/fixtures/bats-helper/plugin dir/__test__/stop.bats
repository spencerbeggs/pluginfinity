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
	run_monitor claude nope
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"run_monitor: no monitor nope"* ]]
}

@test "run_hook applies fail-closed from the entry, so a crash denies, on both targets" {
	run_hook claude hooks/crash.sh "$(hook_fixture PreToolUse '{"tool_name":"Bash"}')"
	assert_hook_json .hookSpecificOutput.permissionDecision deny
	run_hook copilot hooks/crash.sh "$(hook_fixture PreToolUse '{"tool_name":"Bash"}')"
	assert_hook_json .permissionDecision deny
}

@test "run_hook gives Claude PLUGINFINITY_EVENT from the entry, not the payload" {
	run_hook claude hooks/envhook.sh "$(hook_fixture Bogus)" --matcher Read 2>"$BATS_TEST_TMPDIR/warn"
	[[ "$(cat "$BATS_TEST_TMPDIR/warn")" == *"run_hook: no hooks/envhook.sh entry for event Bogus; using entries for any event"* ]]
	[[ "$stderr" == *"PreToolUse||read-b" ]]
}

@test "run_hook reads a Claude command-string entry and unquotes its exported env" {
	run_hook claude hooks/cmdhook.sh "$(hook_fixture PostToolUse)"
	[[ "$stderr" == "PostToolUse||it's a=b" ]]
}

@test "run_hook takes only leading K=V args as env, not author args after the script" {
	run_hook claude hooks/argshook.sh "$(hook_fixture PostToolUse)"
	[[ "$stderr" == "PostToolUse||" ]]
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

@test "run_hook reads --matcher anywhere in the trailing list, mixed with VAR=value" {
	for target in claude copilot; do
		run_hook "$target" hooks/envhook.sh "$(hook_fixture PreToolUse)" EXTRA=mine --matcher Bash PLUGINFINITY_FAIL_CLOSED=0
		[[ "$stderr" == "PreToolUse|0|mine" ]]
		run_hook "$target" hooks/envhook.sh "$(hook_fixture PreToolUse)" PLUGINFINITY_FAIL_CLOSED=0 --matcher Read
		[[ "$stderr" == "PreToolUse|0|read-b" ]]
	done
}

@test "run_hook reads --session-env and --env-wait after a VAR=value" {
	printf 'FX_A=seeded\n' >"$BATS_TEST_TMPDIR/seed"
	run_hook claude hooks/startenv.sh "$(hook_fixture SessionStart '{"source":"startup"}')" EXTRA=x --session-env "$BATS_TEST_TMPDIR/seed" --env-wait
	[ "$status" -eq 0 ]
	[ -n "$(find "$BATS_TEST_TMPDIR/state/pluginfinity/fixture/session" -name env 2>/dev/null)" ]
	[[ "$stderr" == "SessionStart||x" ]]
}

@test "run_hook keeps a VAR=value whose value starts with -- as a VAR=value" {
	run_hook claude hooks/envhook.sh "$(hook_fixture PreToolUse)" --matcher Bash EXTRA=--matcher
	[[ "$stderr" == "PreToolUse|1|--matcher" ]]
	run_hook claude hooks/envhook.sh "$(hook_fixture PreToolUse)" --matcher Bash EXTRA=--env-wait
	[[ "$stderr" == "PreToolUse|1|--env-wait" ]]
}

@test "run_script runs a skill script from the project dir on both targets" {
	for target in claude copilot; do
		run_script "$target" skills/s/scripts/show.sh --env FOO=1 a=b
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

@test "run_hook --matcher reads the matcher from env on Copilot, from the group on Claude" {
	for target in claude copilot; do
		run_hook "$target" hooks/startenv.sh "$(hook_fixture SessionStart '{"source":"resume"}')" --matcher resume
		[[ "$stderr" == "SessionStart||resume-b" ]]
		run_hook "$target" hooks/startenv.sh "$(hook_fixture SessionStart '{"source":"startup"}')" --matcher startup
		[[ "$stderr" == "SessionStart||startup-a" ]]
	done
}

@test "run_script passes a literal -- and later arguments to the script" {
	for target in claude copilot; do
		run_script "$target" skills/s/scripts/show.sh "msg" -- --no-verify
		[ "$status" -eq 0 ]
		[ "$output" = "pwd=$BATS_TEST_TMPDIR/project foo= args=msg -- --no-verify" ]
	done
}

@test "run_script --env is repeatable and --env FOO=1 reaches the environment" {
	run_script claude skills/s/scripts/show.sh --env FOO=1 --env BAR=2 x
	[ "$output" = "pwd=$BATS_TEST_TMPDIR/project foo=1 args=x" ]
}

@test "run_script --env rejects a malformed assignment" {
	run --separate-stderr run_script claude skills/s/scripts/show.sh --env 1X=2
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"run_script: --env needs VAR=value"* ]]
	run --separate-stderr run_script claude skills/s/scripts/show.sh --env
	[ "$status" -eq 1 ]
	run --separate-stderr run_script claude skills/s/scripts/show.sh --env 'A-B=2'
	[ "$status" -eq 1 ]
}

@test "the project dir is one default: fixture cwd, a skill script's cwd and run_hook's CLAUDE_PROJECT_DIR" {
	fx=$(hook_fixture Stop)
	[ "$(jq -r .cwd "$fx")" = "$BATS_TEST_TMPDIR/project" ]
	[ -d "$BATS_TEST_TMPDIR/project" ]
	run_script claude skills/s/scripts/proj.sh
	[[ "$output" == "pwd=$BATS_TEST_TMPDIR/project "* ]]
}

@test "run_script gives a Claude skill script only CLAUDE_CODE_SESSION_ID, as the Bash tool does" {
	run_script claude skills/s/scripts/proj.sh
	[ "$output" = "pwd=$BATS_TEST_TMPDIR/project project=unset root=unset data=unset skill=unset envfile=unset session=test-session plugin_root=unset args=" ]
	# HOOK_PROJECT_DIR no longer maps onto a skill script's environment.
	HOOK_PROJECT_DIR="$BATS_TEST_TMPDIR/other" run_script claude skills/s/scripts/proj.sh
	[[ "$output" == *"project=unset root=unset"* ]]
}

@test "run_script --env can override CLAUDE_CODE_SESSION_ID" {
	run_script claude skills/s/scripts/proj.sh --env CLAUDE_CODE_SESSION_ID=mine
	[[ "$output" == *"session=mine "* ]]
}

@test "run_script gives a Copilot skill script no Claude variables and invents no session id" {
	run_script copilot skills/s/scripts/proj.sh
	[ "$output" = "pwd=$BATS_TEST_TMPDIR/project project=unset root=unset data=unset skill=unset envfile=unset session=unset plugin_root=unset args=" ]
}

@test "run_script keeps the plugin variables for a server launcher" {
	run_script claude servers/proj.sh
	[[ "$output" == *"project=$BATS_TEST_TMPDIR/project root=$PLUGIN_DIR/builds/claude "* ]]
	run_script copilot servers/proj.sh
	[[ "$output" == *"plugin_root=$PLUGIN_DIR/builds/copilot "* ]]
}

@test "run_script --env-file adds parsed exports: export prefix, quotes stripped, no expansion" {
	cat >"$BATS_TEST_TMPDIR/session.env" <<'ENV'
# written by SessionStart
export A_ONE=plain
B_TWO='single quoted $HOME'
export C_THREE="double \$HOME"

D_FOUR=a=b
ENV
	for target in claude copilot; do
		run_script "$target" skills/s/scripts/vars.sh --env-file "$BATS_TEST_TMPDIR/session.env"
		[ "$status" -eq 0 ]
		[ "$output" = 'a=plain b=single quoted $HOME c=double \$HOME d=a=b' ]
	done
}

@test "run_script --env-file lets --env win and rejects a missing file" {
	printf 'A_ONE=file\n' >"$BATS_TEST_TMPDIR/s.env"
	run_script claude skills/s/scripts/vars.sh --env-file "$BATS_TEST_TMPDIR/s.env" --env A_ONE=flag
	[[ "$output" == "a=flag "* ]]
	run --separate-stderr run_script claude skills/s/scripts/vars.sh --env-file "$BATS_TEST_TMPDIR/none.env"
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"run_script: --env-file $BATS_TEST_TMPDIR/none.env not found"* ]]
}

@test "run_monitor ignores HOOK_PROJECT_DIR and uses the project dir" {
	HOOK_PROJECT_DIR="$BATS_TEST_TMPDIR/other" run_monitor claude show
	[[ "$output" == "pwd=$BATS_TEST_TMPDIR/project "* ]]
}

@test "run_script runs a .mjs script under node on both targets, with the host env and cwd" {
	project=$(cd "$(_pf_project_dir)" && pwd -P)
	for target in claude copilot; do
		run_script "$target" skills/s/scripts/node.mjs --env FOO=1 a b
		[ "$status" -eq 0 ]
		want="node pwd=$project session=test-session foo=1 args=a b"
		[ "$target" = copilot ] && want="node pwd=$project session=unset foo=1 args=a b"
		[ "$output" = "$want" ]
	done
}

@test "run_script runs .cjs under node and an extensionless script under bash" {
	run_script claude skills/s/scripts/cjs.cjs
	[ "$output" = "cjs ok" ]
	run_script claude skills/s/scripts/noext x
	[ "$output" = "pwd=$BATS_TEST_TMPDIR/project foo= args=x" ]
}

@test "run_script --interpreter overrides the extension" {
	run_script claude skills/s/scripts/show.sh --interpreter 'bash -x' q
	[ "$status" -eq 0 ]
	[[ "$output" == *"args=q"* ]]
	run_script claude skills/s/scripts/py.txt --interpreter cat
	[ "$output" = "print('x')" ]
	run_script claude skills/s/scripts/py.txt --interpreter false
	[ "$status" -eq 1 ]
}

@test "run_monitor --timeout kills a monitor that never exits and sets status 124" {
	run_monitor claude hang --timeout 1
	[ "$status" -eq 124 ]
	[[ "$stderr" == *"run_monitor: hang timed out after 1s"* ]]
	run pgrep -f "sleep 4242"
	[ "$status" -ne 0 ]
}

@test "run_monitor --timeout kills a monitor that ignores TERM" {
	run_monitor claude stubborn --timeout 1
	[ "$status" -eq 124 ]
	run pgrep -f "sleep 4343"
	[ "$status" -ne 0 ]
	run pgrep -f "stubborn.sh"
	[ "$status" -ne 0 ]
}

@test "run_monitor --timeout does not disturb a monitor that finishes in time" {
	run_monitor claude m --timeout 20
	[ "$status" -eq 0 ]
	[ "$output" = "first hello" ]
	[[ "$stderr" != *timed* ]]
}

@test "run_monitor rejects a non-numeric --timeout" {
	run_monitor claude m --timeout soon
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"run_monitor: --timeout needs a number of seconds"* ]]
}

@test "run_monitor rejects --timeout 0" {
	run_monitor claude m --timeout 0
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"run_monitor: --timeout needs a number of seconds above 0, got '0'"* ]]
	run_monitor claude m --timeout 00
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"above 0, got '00'"* ]]
}

@test "run_monitor --session-env seeds under the caller's own XDG_STATE_HOME" {
	printf 'FX_A=seeded\n' >"$BATS_TEST_TMPDIR/session.env"
	run_monitor claude envmon --session-env "$BATS_TEST_TMPDIR/session.env"
	[ "$output" = "FX_A=seeded" ]
	run_monitor claude envmon --session-env "$BATS_TEST_TMPDIR/session.env" XDG_STATE_HOME="$BATS_TEST_TMPDIR/own"
	[ "$output" = "FX_A=seeded" ]
	[ -e "$BATS_TEST_TMPDIR/own/pluginfinity/fixture/session/test-session/env" ]
}
