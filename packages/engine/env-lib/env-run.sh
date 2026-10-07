# shellcheck shell=sh
# pluginfinity session env runner. `pluginfinity build` writes this file at
# lib/pluginfinity/env-run.sh into every target whose config declares `env`,
# and runs it as the first SessionStart entry; do not edit a copy under builds/.
#
# POSIX sh. Run as a script (`sh <path>`), with the SessionStart event on stdin.
# Writes nothing to stdout and always exits 0: every problem is a log line.
#
# Once per SessionStart (every source) it resolves each declared name through
# rungs 1-5 (default, setup output, <project>/.env, <project>/.env.local, the
# environment this process inherited), then writes the resolved values to the
# session values file, points the project at this session, and on Claude
# appends `export NAME='value'` lines to CLAUDE_ENV_FILE for the Bash tool.
#
# The setup script runs under bash with cwd the project, the hook environment
# plus PLUGINFINITY_EVENT=SessionStart, and the event on stdin. Its stdout is
# NAME=value lines (blank and # lines ignored, values literal, later lines
# win); an undeclared name is skipped with a log line. It is bounded by
# _pf_env_setup_timeout seconds: on timeout nothing it printed is kept; on a
# non-zero exit its valid lines are kept.

_pf_env_lib_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" 2>/dev/null && pwd) || exit 0
_pf_env_manual=1
_pf_env_component=hook
[ -r "$_pf_env_lib_dir/env.sh" ] || exit 0
# shellcheck source=/dev/null
. "$_pf_env_lib_dir/env.sh" || exit 0
[ -n "$_pf_env_names" ] || exit 0

_pf_r_tmp=$(mktemp -d "${TMPDIR:-/tmp}/pluginfinity-env.XXXXXX" 2>/dev/null) || {
	_pf_env_log "cannot create a temporary directory; session env not resolved"
	exit 0
}
trap 'rm -rf "$_pf_r_tmp" 2>/dev/null' EXIT

if [ -t 0 ]; then
	printf '{}' >"$_pf_r_tmp/input"
else
	cat >"$_pf_r_tmp/input" 2>/dev/null || :
fi

# A top-level string field of the event: jq when present, else a plain match
# that gives up on escapes.
_pf_r_field() {
	if command -v jq >/dev/null 2>&1; then
		jq -r --arg k "$1" 'if type == "object" then (.[$k] // empty) | strings else empty end' \
			<"$_pf_r_tmp/input" 2>/dev/null || :
	else
		tr -d '\n' <"$_pf_r_tmp/input" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"\\\\]*\)\".*/\1/p"
	fi
}

_pf_r_sid=$(_pf_r_field session_id)
[ -n "$_pf_r_sid" ] || _pf_r_sid=$(_pf_r_field sessionId)
_pf_r_cwd=$(_pf_r_field cwd)

# The project: the event's cwd walked up to .git. Without one, Claude's rule
# for a script; Copilot runs hooks from the plugin root, which is no project.
case $_pf_r_cwd in
/*) _pf_r_proj=$(_pf_env_project_of "$_pf_r_cwd") ;;
*)
	if [ "${PLUGINFINITY_HOST:-}" = copilot ]; then
		_pf_r_proj=
		_pf_env_log "the event has no cwd; .env files not read"
	else
		_pf_r_proj=$(_pf_env_script_project)
	fi
	;;
esac

_pf_env_init

# Rung 2: the setup script.
_pf_r_setup() {
	[ -n "$_pf_env_setup" ] || return 0
	_pf_r_script="$_pf_env_lib_dir/../../$_pf_env_setup"
	if [ ! -f "$_pf_r_script" ]; then
		_pf_env_log "setup script $_pf_env_setup is missing; skipped"
		return 0
	fi
	_pf_r_t=$_pf_env_setup_timeout
	case $_pf_r_t in '' | *[!0123456789]*) _pf_r_t=10 ;; esac
	_pf_r_in=${_pf_r_proj:-$PWD}
	(
		CDPATH='' cd -- "$_pf_r_in" 2>/dev/null || exit 1
		PLUGINFINITY_EVENT=SessionStart
		export PLUGINFINITY_EVENT
		exec bash "$_pf_r_script"
	) <"$_pf_r_tmp/input" >"$_pf_r_tmp/out" 2>"$_pf_r_tmp/err" &
	_pf_r_pid=$!
	(
		sleep "$_pf_r_t"
		: >"$_pf_r_tmp/timedout"
		kill -TERM "$_pf_r_pid" 2>/dev/null
	) </dev/null >/dev/null 2>&1 &
	_pf_r_watch=$!
	if wait "$_pf_r_pid"; then _pf_r_rc=0; else _pf_r_rc=$?; fi
	kill "$_pf_r_watch" 2>/dev/null || :
	if pf_debug_on 2>/dev/null && [ -s "$_pf_r_tmp/err" ]; then
		head -n 20 "$_pf_r_tmp/err" | while IFS= read -r _pf_r_l; do _pf_env_debug "setup: $_pf_r_l"; done
	fi
	if [ -e "$_pf_r_tmp/timedout" ]; then
		_pf_env_log "setup script $_pf_env_setup timed out after ${_pf_r_t}s; its output is discarded"
		return 0
	fi
	[ "$_pf_r_rc" -eq 0 ] || _pf_env_log "setup script $_pf_env_setup exited $_pf_r_rc; keeping its valid lines"
	while IFS= read -r _pf_e_l || [ -n "$_pf_e_l" ]; do
		case $_pf_e_l in '' | '#'*) continue ;; esac
		_pf_e_k=${_pf_e_l%%=*}
		[ "$_pf_e_k" != "$_pf_e_l" ] || continue
		if _pf_env_declared "$_pf_e_k"; then
			_pf_e_v=${_pf_e_l#*=}
			eval "_pf_env_val_$_pf_e_k=\$_pf_e_v"
		elif _pf_env_is_name "$_pf_e_k"; then
			_pf_env_log "setup printed $_pf_e_k, which is not declared; skipped"
		fi
	done <"$_pf_r_tmp/out"
	return 0
}
_pf_r_setup

# Rungs 3-5.
_pf_env_live "$_pf_r_proj"

if _pf_env_valid_id "$_pf_r_sid"; then
	if _pf_env_write_values "$(_pf_env_values_path "$_pf_r_sid")" && [ -n "$_pf_r_proj" ]; then
		_pf_r_ptr=$(_pf_env_pointer_path "$_pf_r_proj")
		if (umask 077 && mkdir -p "$(dirname -- "$_pf_r_ptr")") 2>/dev/null &&
			printf '%s\n%s\n' "$_pf_r_sid" "$_pf_r_proj" >"$_pf_r_ptr.tmp.$$" 2>/dev/null &&
			mv -f "$_pf_r_ptr.tmp.$$" "$_pf_r_ptr" 2>/dev/null; then
			:
		else
			rm -f "$_pf_r_ptr.tmp.$$" 2>/dev/null
			_pf_env_log "cannot write the project pointer"
		fi
	fi
elif [ -z "$_pf_r_sid" ]; then
	_pf_env_log "the event has no session id; session values not written"
else
	_pf_env_log "invalid session id; session values not written"
fi

# shellcheck disable=SC2086 # the names are words
_pf_env_claude_export $_pf_env_names
exit 0
