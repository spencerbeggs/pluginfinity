# shellcheck shell=bash
# pluginfinity's bats helper: run a plugin's built hook scripts the way each
# host runs them, and assert on the response.
#
# Load it from plugins/<name>/__test__/*.bats:
#   load "$BATS_TEST_DIRNAME/../node_modules/pluginfinity/bats/pluginfinity.bash"
#
# Tests run against builds/<target>/, so run `pluginfinity build` first.

bats_require_minimum_version 1.5.0

: "${PLUGIN_DIR:=$(cd "$BATS_TEST_DIRNAME/.." && pwd)}"

# run_hook <target> <script> <fixture> [--matcher <m>] [VAR=value...]
# Runs builds/<target>/<script> under env -i the way the host runs the built
# hook entry: the entry in the target's hooks file that runs <script>, under the
# fixture's hook_event_name (else the event of the first such entry), supplies
# the environment (Claude: the K=V args before `bash`; Copilot: the `env`
# object). --matcher picks between entries for one script. Explicit VAR=value
# arguments override the entry's environment. The fixture is on stdin.
# Sets $status, $output and $stderr.
run_hook() {
	local target=$1 script=$2 fixture=$3 matcher="" has_matcher=0
	shift 3
	if [ "${1:-}" = "--matcher" ]; then
		matcher=${2:-}
		has_matcher=1
		shift 2
	fi
	local root="$PLUGIN_DIR/builds/$target"
	if [ ! -f "$root/$script" ]; then
		echo "run_hook: $root/$script not found; run pluginfinity build" >&2
		return 1
	fi
	case "$fixture" in
	/*) ;;
	*) fixture="$PLUGIN_DIR/__test__/fixtures/$fixture" ;;
	esac
	local hooks_file entries
	case "$target" in
	claude)
		hooks_file="$root/hooks/hooks.json"
		entries='[(.hooks // {}) | to_entries[] | .key as $ev | .value[] | (.matcher // "") as $m | (.hooks // [])[]
			| select((.args // []) | map(type == "string" and endswith("/" + $s)) | any)
			| {event: $ev, matcher: $m, env: (.args | (index("bash") // length) as $i | .[:$i]
				| map(select(test("^[A-Za-z_][A-Za-z0-9_]*=")) | {key: sub("=.*$"; ""; "s"), value: sub("^[^=]*="; ""; "s")}) | from_entries)}]'
		;;
	copilot)
		hooks_file="$root/com.github.copilot/hooks/hooks.json"
		entries='[(.hooks // {}) | to_entries[] | .key as $ev | .value[]
			| select((.bash // "") | (contains("/" + $s + "\"") or contains("/" + $s + " ") or endswith("/" + $s)))
			| {event: $ev, matcher: (.matcher // ""), env: (.env // {})}]'
		;;
	*)
		echo "run_hook: unknown target $target" >&2
		return 1
		;;
	esac
	if [ ! -f "$hooks_file" ]; then
		echo "run_hook: $hooks_file not found; run pluginfinity build" >&2
		return 1
	fi
	local event picked count
	event=$(jq -r '.hook_event_name // empty' "$fixture")
	picked=$(jq -c --arg s "$script" --arg e "$event" --arg m "$matcher" --argjson hm "$has_matcher" "$entries"'
		| (if $e == "" then . else (map(select((.event | ascii_downcase) == ($e | ascii_downcase))) as $x | if ($x | length) > 0 then $x else . end) end)
		| (if $hm == 1 then map(select(.matcher == $m)) else . end)' "$hooks_file") || {
		echo "run_hook: cannot read $hooks_file" >&2
		return 1
	}
	count=$(jq 'length' <<<"$picked")
	if [ "$count" -eq 0 ]; then
		if [ "$has_matcher" -eq 1 ]; then
			echo "run_hook: no entry in $hooks_file runs $script with matcher '$matcher'" >&2
		else
			echo "run_hook: no entry in $hooks_file runs $script" >&2
		fi
		return 1
	fi
	if [ "$count" -gt 1 ] && [ "$has_matcher" -eq 0 ]; then
		echo "run_hook: $count entries run $script; using the first (pass --matcher)" >&2
	fi
	local entry_env=() line
	while IFS= read -r line; do
		entry_env+=("$line")
	done < <(jq -r '.[0].env | to_entries[] | "\(.key)=\(.value)"' <<<"$picked")
	case "$target" in
	claude)
		run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" \
			XDG_STATE_HOME="$BATS_TEST_TMPDIR/state" CLAUDE_PLUGIN_ROOT="$root" \
			CLAUDE_PROJECT_DIR="${HOOK_PROJECT_DIR:-$BATS_TEST_TMPDIR}" \
			${entry_env[@]+"${entry_env[@]}"} "$@" bash "$root/$script" <"$fixture"
		;;
	copilot)
		# Copilot runs hooks from the plugin root.
		run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" \
			XDG_STATE_HOME="$BATS_TEST_TMPDIR/state" PLUGIN_ROOT="$root" \
			${entry_env[@]+"${entry_env[@]}"} "$@" bash -c 'cd "$1" && shift && exec bash "$@"' _ "$root" "$root/$script" <"$fixture"
		;;
	esac
}

# _pf_host_env <target> <root>: set the _pf_env array to the env -i arguments
# every host gives a plugin process (hook-only variables are added by run_hook).
_pf_host_env() {
	_pf_env=(PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$BATS_TEST_TMPDIR/state")
	case "$1" in
	claude) _pf_env+=(CLAUDE_PLUGIN_ROOT="$2" CLAUDE_PROJECT_DIR="${HOOK_PROJECT_DIR:-$BATS_TEST_TMPDIR}") ;;
	copilot) _pf_env+=(PLUGIN_ROOT="$2") ;;
	*)
		echo "unknown target $1" >&2
		return 1
		;;
	esac
}

# run_script <target> <path> [--stdin <file>] [args...]
# Runs `bash builds/<target>/<path> args...` under env -i with the host's
# environment: a skill script or a server launcher. Stdin is /dev/null unless
# --stdin is given. Sets $status, $output and $stderr.
run_script() {
	local target=$1 script=$2 stdin=/dev/null
	shift 2
	if [ "${1:-}" = "--stdin" ]; then
		stdin=$2
		shift 2
	fi
	local root="$PLUGIN_DIR/builds/$target"
	if [ ! -f "$root/$script" ]; then
		echo "run_script: $root/$script not found; run pluginfinity build" >&2
		return 1
	fi
	_pf_host_env "$target" "$root" || {
		echo "run_script: unknown target $target" >&2
		return 1
	}
	if [ "$target" = copilot ]; then
		# Copilot runs from the plugin root.
		run --separate-stderr env -i "${_pf_env[@]}" bash -c 'cd "$1" && shift && exec bash "$@"' _ "$root" "$root/$script" "$@" <"$stdin"
	else
		run --separate-stderr env -i "${_pf_env[@]}" bash "$root/$script" "$@" <"$stdin"
	fi
}

# run_monitor <target> <name> [--ticks <n>] [VAR=value...]
# Runs the monitor's command from builds/claude/monitors/monitors.json under
# bash -c with CLAUDE_PLUGIN_ROOT set, stdin /dev/null and
# PLUGINFINITY_MONITOR_MAX_TICKS bounded (default 1). Sets $status, $output and
# $stderr.
run_monitor() {
	local target=$1 name=$2 ticks=1
	shift 2
	if [ "$target" != claude ]; then
		echo "run_monitor: $target has no monitors" >&2
		return 1
	fi
	if [ "${1:-}" = "--ticks" ]; then
		ticks=$2
		shift 2
	fi
	local root="$PLUGIN_DIR/builds/claude" command
	command=$(jq -r --arg n "$name" '[.[] | select(.name == $n)][0].command // empty' "$root/monitors/monitors.json" 2>/dev/null)
	if [ -z "$command" ]; then
		echo "run_monitor: no monitor $name" >&2
		return 1
	fi
	_pf_host_env claude "$root"
	run --separate-stderr env -i "${_pf_env[@]}" PLUGINFINITY_MONITOR_MAX_TICKS="$ticks" "$@" bash -c "$command" </dev/null
}

# assert_hook_exit <n>
assert_hook_exit() {
	[ "$status" -eq "$1" ] || {
		echo "exit $status, expected $1; stderr: $stderr" >&2
		return 1
	}
}

# assert_hook_json <jq-filter> <expected>: compare the filter's raw value.
assert_hook_json() {
	local got
	got=$(printf '%s' "$output" | jq -r "$1" 2>/dev/null) || {
		echo "stdout is not JSON: $output" >&2
		return 1
	}
	[ "$got" = "$2" ] || {
		echo "$1 is '$got', expected '$2'; stdout: $output" >&2
		return 1
	}
}

# assert_hook_noop: exit 0 with no response or an empty object.
assert_hook_noop() {
	if [ "$status" -eq 0 ] && { [ -z "$output" ] || [ "$output" = "{}" ]; }; then return 0; fi
	echo "expected a no-op, got exit $status: $output" >&2
	return 1
}

# hook_fixture <event> [overrides-json]: write a Claude-shaped input for
# <event> to a temp file and print its path.
hook_fixture() {
	local overrides=${2:-}
	[ -n "$overrides" ] || overrides='{}'
	local file="$BATS_TEST_TMPDIR/fixture-$1-$RANDOM.json"
	jq -n --arg e "$1" --arg cwd "$BATS_TEST_TMPDIR" --argjson o "$overrides" \
		'{session_id: "test-session", transcript_path: "/dev/null", cwd: $cwd, hook_event_name: $e} + $o' >"$file"
	printf '%s\n' "$file"
}
