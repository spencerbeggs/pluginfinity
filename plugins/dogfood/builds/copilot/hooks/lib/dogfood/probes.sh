#!/usr/bin/env bash
# Round-3 live probes for the dogfood fixture. Sourced by session-start.sh,
# after the hook library, so hook_debug exists. Fail open and quiet: every line
# goes to debug.log (PLUGINFINITY_DEBUG=1), and only variable names are logged,
# never values, apart from the CLAUDE_ENV_FILE path the probe asks for.

# probe_session_start <session_id>: does CLAUDE_ENV_FILE reach later hooks?
probe_session_start() {
	local sid=$1 is_set=no names dir in_path=no files
	if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
		is_set=yes
		printf "export PF_ENV_PROBE='%s'\n" "$sid" >>"$CLAUDE_ENV_FILE" 2>/dev/null ||
			hook_debug "probe: env-file append failed"
	fi
	if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
		dir=$(dirname "$CLAUDE_ENV_FILE")
		case "$CLAUDE_ENV_FILE" in *"$sid"*) [ -n "$sid" ] && in_path=yes ;; esac
		hook_debug "probe: env-file dir=$dir base=$(basename "$CLAUDE_ENV_FILE") session_in_path=$in_path"
		files=$(ls -1 "$dir" 2>/dev/null | tr '\n' ' ') || true
		hook_debug "probe: env-dir files=${files:-none}"
		# A separate *hook*.sh file in the same directory: does it reach later hooks or the shell tool?
		if [ -d "$dir" ] && [ -w "$dir" ]; then
			printf "export PF_DIR_PROBE='%s'\n" "$sid" >"$dir/pf-dogfood-hook.sh" 2>/dev/null ||
				hook_debug "probe: env-dir write failed"
		else
			hook_debug "probe: env-dir not writable"
		fi
	fi
	hook_debug "probe: env-file set=$is_set path=${CLAUDE_ENV_FILE:-unset}"
	names=$(env | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' | cut -d= -f1 | grep -E 'ENV_FILE|_ENV$|COPILOT_' | tr '\n' ' ') || true
	hook_debug "probe: copilot-hook-env names=${names:-none}"
}
