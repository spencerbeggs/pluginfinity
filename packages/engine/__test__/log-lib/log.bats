# shellcheck shell=bash
load helpers

@test "pf_log writes one formatted line to error.log" {
	make_root claude fixture
	script_body 'pf_log hook "boom"'
	run_it
	[ "$status" -eq 0 ] && [ -z "$output" ]
	line=$(cat "$STATE/pluginfinity/fixture/error.log")
	[[ "$line" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z\ \[claude\]\ hook/run\.sh:\ boom$ ]]
}

@test "pf_debug is silent unless PLUGINFINITY_DEBUG=1" {
	make_root copilot fixture
	script_body 'pf_debug script "hi"'
	run_it
	[ ! -e "$STATE/pluginfinity/fixture/debug.log" ]
	run_it PLUGINFINITY_DEBUG=1
	[[ "$(cat "$STATE/pluginfinity/fixture/debug.log")" == *"[copilot] script/run.sh: hi" ]]
}

@test "PLUGINFINITY_HOOK_DEBUG no longer turns debugging on" {
	make_root claude fixture
	script_body 'pf_debug hook x'
	run_it PLUGINFINITY_HOOK_DEBUG=1
	[ ! -e "$STATE/pluginfinity/fixture/debug.log" ]
}

@test "an unwritable state dir is not an error" {
	make_root claude fixture
	script_body 'pf_log hook x; echo ok'
	run_it XDG_STATE_HOME=/dev/null/nope
	[ "$output" = ok ]
}

@test "host.sh from log.sh's own directory names host and plugin for a skill script" {
	make_root copilot my-plugin
	script_body 'script_log "from a skill"'
	run_it
	[[ "$(cat "$STATE/pluginfinity/my-plugin/error.log")" == *"[copilot] script/run.sh: from a skill" ]]
}

@test "pf_debug_on reflects PLUGINFINITY_DEBUG" {
	make_root claude fixture
	script_body 'if pf_debug_on; then echo on; else echo off; fi'
	run_it
	[ "$output" = off ]
	run_it PLUGINFINITY_DEBUG=1
	[ "$output" = on ]
}
