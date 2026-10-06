# shellcheck shell=bash
load helpers

@test "monitor_notify writes one line with newlines folded" {
	make_root claude fx; monitor_body 'monitor_notify "a
b"'; run_it; [ "$output" = "a b" ]
}

@test "monitor_notify ignores empty text" {
	make_root claude fx; monitor_body 'monitor_notify ""'; run_it PLUGINFINITY_DEBUG=1
	[ -z "$output" ]; [[ "$(cat "$STATE/pluginfinity/fx/debug.log")" == *"monitor/m.sh: monitor_notify: empty text ignored" ]]
}

@test "monitor_once notifies once per key" {
	make_root claude fx; monitor_body 'monitor_once k "hi"; monitor_once k "hi"; monitor_once j "yo"'
	run_it; [ "$output" = "$(printf 'hi\nyo')" ]
}

@test "monitor_once dedups across runs in one session and not across sessions" {
	make_root claude fx; monitor_body 'monitor_once k "hi"'
	run_it CLAUDE_SESSION_ID=s1; [ "$output" = hi ]
	run_it CLAUDE_SESSION_ID=s1; [ -z "$output" ]
	run_it CLAUDE_SESSION_ID=s2; [ "$output" = hi ]
}

@test "monitor_every keeps polling after a failing tick and logs it" {
	make_root claude fx
	monitor_body 'n=0; tick() { n=$((n+1)); [ "$n" -ne 2 ] || return 3; monitor_notify "t$n"; }; monitor_every 0 tick'
	run_it PLUGINFINITY_MONITOR_MAX_TICKS=3
	[ "$status" -eq 0 ]
	[ "$output" = "$(printf 't1\nt3')" ]; [[ "$(cat "$STATE/pluginfinity/fx/error.log")" == *"monitor/m.sh: tick failed (exit 3)"* ]]
}

@test "monitor_every exits 0 when stdout closes" {
	make_root claude fx
	monitor_body 'tick() { monitor_notify x; }; monitor_every 0 tick'
	run bash -c "env -i PATH=\"$PATH\" HOME=\"$BATS_TEST_TMPDIR/home\" XDG_STATE_HOME=\"$STATE\" ${SH_UNDER_TEST:-sh} \"$ROOT/monitors/m.sh\" | head -n 2; exit \${PIPESTATUS[0]}"
	[ "$status" -eq 0 ]
	[ "$output" = "$(printf 'x\nx')" ]
}

@test "monitor_name prefers PLUGINFINITY_MONITOR" {
	make_root claude fx; monitor_body 'monitor_notify "$(monitor_name)"'; run_it PLUGINFINITY_MONITOR=dogfood-mail
	[ "$output" = dogfood-mail ]
	run_it; [ "$output" = m ]
}

@test "monitor_host, monitor_plugin_root and monitor_project_dir" {
	make_root copilot fx
	monitor_body 'monitor_notify "$(monitor_host) $(cd "$(monitor_plugin_root)" && pwd -P)"; monitor_notify "$(monitor_project_dir)"'
	run_it CLAUDE_PROJECT_DIR=/proj
	[ "${lines[0]}" = "copilot $(cd "$ROOT" && pwd -P)" ]; [ "${lines[1]}" = /proj ]
}

@test "monitor_state_dir is created under the plugin and monitor name" {
	make_root claude fx; monitor_body 'monitor_notify "$(monitor_state_dir)"'; run_it
	[ "$output" = "$STATE/pluginfinity/fx/monitor/m/" ] || [ "$output" = "$STATE/pluginfinity/fx/monitor/m" ]
	[ -d "$STATE/pluginfinity/fx/monitor/m" ]
}

@test "sourcing writes nothing" {
	make_root copilot fx; monitor_body ':'; run_it; [ -z "$output" ]
}

@test "sourcing works with only _pf_log_dir set" {
	make_root claude fx
	printf '#!/bin/sh\n_pf_log_dir="$(dirname "$0")/../lib/pluginfinity"; . "$_pf_log_dir/monitor.sh"\nmonitor_log boom; monitor_notify hi\n' >"$ROOT/monitors/m.sh"
	run_it
	[ "$output" = hi ]; [[ "$(cat "$STATE/pluginfinity/fx/error.log")" == *"monitor/m.sh: boom" ]]
}

@test "sourcing with neither variable set still runs, silently" {
	make_root claude fx
	printf '#!/bin/sh\n. "$(dirname "$0")/../lib/pluginfinity/monitor.sh"\nmonitor_log boom; monitor_notify hi\n' >"$ROOT/monitors/m.sh"
	run_it
	[ "$status" -eq 0 ]; [ "$output" = hi ]
}

@test "monitor_every with a bad interval falls back and logs" {
	make_root claude fx
	monitor_body 'tick() { monitor_notify x; }; monitor_every abc tick'
	run_it PLUGINFINITY_MONITOR_MAX_TICKS=1
	[ "$output" = x ]; [[ "$(cat "$STATE/pluginfinity/fx/error.log")" == *"interval 'abc'"* ]]
}
