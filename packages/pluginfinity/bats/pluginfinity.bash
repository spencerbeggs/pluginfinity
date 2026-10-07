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

# _pf_project_dir: print the test's project directory, $BATS_TEST_TMPDIR/project,
# creating it on first use. It is the default for hook_fixture's cwd,
# HOOK_PROJECT_DIR (so CLAUDE_PROJECT_DIR), a skill script's cwd and a
# monitor's cwd, so one test sees one project everywhere.
_pf_project_dir() {
	mkdir -p "$BATS_TEST_TMPDIR/project"
	printf '%s\n' "$BATS_TEST_TMPDIR/project"
}

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
	local root="$PLUGIN_DIR/builds/$target" project
	project=$(_pf_project_dir)
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
		# An exec-form entry (`env K=V ... bash <script>`) or a command-string entry
		# (`export K='V'; ... <command>`); the env is the leading assignments of each.
		entries='[(.hooks // {}) | to_entries[] | .key as $ev | .value[] | (.matcher // "") as $m | (.hooks // [])[]
			| (if ((.args // []) | map(type == "string" and endswith("/" + $s)) | any) then
					{event: $ev, matcher: $m, env: (.args | (map(test("^[A-Za-z_][A-Za-z0-9_]*=")) | index(false) // length) as $i | .[:$i]
						| map({key: sub("=.*$"; ""; "s"), value: sub("^[^=]*="; ""; "s")}) | from_entries)}
				elif ((.command // "") | (contains("/" + $s + "\"") or contains("/" + $s + " ") or endswith("/" + $s))) then
					{event: $ev, matcher: $m, env: ((.command | capture("^(?<p>(export [A-Za-z_][A-Za-z0-9_]*=\u0027([^\u0027]|\u0027\\\\\u0027\u0027)*\u0027; )*)").p)
						| [match("export ([A-Za-z_][A-Za-z0-9_]*)=\u0027((?:[^\u0027]|\u0027\\\\\u0027\u0027)*)\u0027; "; "g") | {key: .captures[0].string, value: (.captures[1].string | gsub("\u0027\\\\\u0027\u0027"; "\u0027"))}] | from_entries)}
				else empty end)]'
		;;
	copilot)
		hooks_file="$root/com.github.copilot/hooks/hooks.json"
		entries='[(.hooks // {}) | to_entries[] | .key as $ev | .value[]
			| select((.bash // "") | (contains("/" + $s + "\"") or contains("/" + $s + " ") or endswith("/" + $s)))
			| {event: $ev, matcher: (.matcher // .env.PLUGINFINITY_MATCHER // ""), env: (.env // {})}]'
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
	local event all picked count
	event=$(jq -r '.hook_event_name // empty' "$fixture")
	all=$(jq -c --arg s "$script" "$entries" "$hooks_file") || {
		echo "run_hook: cannot read $hooks_file" >&2
		return 1
	}
	picked=$(jq -c --arg e "$event" --arg m "$matcher" --argjson hm "$has_matcher" '
		(if $e == "" then . else (map(select((.event | ascii_downcase) == ($e | ascii_downcase))) as $x | if ($x | length) > 0 then $x else . end) end)
		| (if $hm == 1 then map(select(.matcher == $m)) else . end)' <<<"$all")
	if [ -n "$event" ] && [ "$(jq 'length' <<<"$all")" -gt 0 ] &&
		[ "$(jq -r --arg e "$event" 'map(select((.event | ascii_downcase) == ($e | ascii_downcase))) | length' <<<"$all")" -eq 0 ]; then
		echo "run_hook: no $script entry for event $event; using entries for any event" >&2
	fi
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
			CLAUDE_PROJECT_DIR="${HOOK_PROJECT_DIR:-$project}" \
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

# _pf_host_env <target> <root> [skill]: set the _pf_env array to the env -i
# arguments a plugin process gets (hook-only variables are added by run_hook).
# With "skill" it is the environment of a script a skill runs through the agent's
# Bash tool, which gets none of the plugin variables, as measured: on Claude Code
# only CLAUDE_CODE_SESSION_ID (and what SessionStart wrote to CLAUDE_ENV_FILE);
# on Copilot nothing beyond the base. A launcher gets the plugin variables.
_pf_host_env() {
	_pf_env=(PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$BATS_TEST_TMPDIR/state")
	case "$1" in
	claude)
		if [ "${3:-}" = skill ]; then
			_pf_env+=(CLAUDE_CODE_SESSION_ID=test-session)
		else
			_pf_env+=(CLAUDE_PLUGIN_ROOT="$2" CLAUDE_PROJECT_DIR="${HOOK_PROJECT_DIR:-$(_pf_project_dir)}")
		fi
		;;
	copilot) [ "${3:-}" = skill ] || _pf_env+=(PLUGIN_ROOT="$2") ;;
	*)
		echo "unknown target $1" >&2
		return 1
		;;
	esac
}

# _pf_read_env_file <file>: append the file's assignments to the filevars array.
# The file is parsed, never sourced: blank lines and # comments are skipped, an
# `export ` prefix is dropped, one pair of surrounding quotes is stripped and
# nothing is expanded.
_pf_read_env_file() {
	local line name value
	while IFS= read -r line || [ -n "$line" ]; do
		line=${line#"${line%%[![:space:]]*}"}
		case "$line" in '' | '#'*) continue ;; esac
		case "$line" in
		"export "*) line=${line#export }; line=${line#"${line%%[![:space:]]*}"} ;;
		esac
		case "$line" in
		[A-Za-z_]*=*) ;;
		*) continue ;;
		esac
		name=${line%%=*}
		value=${line#*=}
		case "$name" in *[!A-Za-z0-9_]*) continue ;; esac
		case "$value" in
		\"*\") value=${value#\"}; value=${value%\"} ;;
		\'*\') value=${value#\'}; value=${value%\'} ;;
		esac
		filevars+=("$name=$value")
	done <"$1"
}

# run_script <target> <path> [--stdin <file>] [--cwd <dir>] [--env VAR=value]... [--env-file <file>] [--interpreter <cmd>] [args...]
# Runs `<interpreter> builds/<target>/<path> args...` under env -i. The
# interpreter is `node` for a .mjs, .cjs or .js script and `bash` otherwise;
# --interpreter <cmd> overrides it (the command may carry arguments, e.g. 'bash -x'). A script under skills/
# gets the environment a skill script gets when the agent runs it through its
# Bash tool: PATH, HOME, XDG_STATE_HOME and, on Claude Code,
# CLAUDE_CODE_SESSION_ID=test-session, with none of CLAUDE_PLUGIN_ROOT,
# CLAUDE_PLUGIN_DATA, CLAUDE_PROJECT_DIR, CLAUDE_SKILL_DIR or CLAUDE_ENV_FILE. It
# runs from --cwd (default $BATS_TEST_TMPDIR/project, created) on both hosts.
# --env-file adds the NAME=value and `export NAME=value` lines of a file, parsed
# not sourced, to model what a SessionStart hook wrote to CLAUDE_ENV_FILE.
# Any other path, a server launcher, gets the host's plugin variables and keeps
# the host's cwd: the plugin root on Copilot, the caller's on Claude. Each --env
# adds VAR=value (after --env-file, so it wins); everything after the options, a
# bare `--` included, is passed to the script as arguments. Sets $status, $output
# and $stderr.
run_script() {
	local target=$1 script=$2 stdin=/dev/null cwd="" interp="" vars=() filevars=()
	shift 2
	while [ $# -gt 0 ]; do
		case "$1" in
		--stdin)
			stdin=$2
			shift 2
			;;
		--cwd)
			cwd=$2
			shift 2
			;;
		--interpreter)
			if [ -z "${2:-}" ]; then
				echo "run_script: --interpreter needs a command" >&2
				return 1
			fi
			interp=$2
			shift 2
			;;
		--env-file)
			if [ ! -f "${2:-}" ]; then
				echo "run_script: --env-file ${2:-} not found" >&2
				return 1
			fi
			_pf_read_env_file "$2"
			shift 2
			;;
		--env)
			case "${2:-}" in
			[A-Za-z_]*=*) ;;
			*)
				echo "run_script: --env needs VAR=value, got '${2:-}'" >&2
				return 1
				;;
			esac
			case "${2%%=*}" in
			*[!A-Za-z0-9_]*)
				echo "run_script: --env needs VAR=value, got '$2'" >&2
				return 1
				;;
			esac
			vars+=("$2")
			shift 2
			;;
		*) break ;;
		esac
	done
	local args=("$@")
	local root="$PLUGIN_DIR/builds/$target" kind=""
	if [ ! -f "$root/$script" ]; then
		echo "run_script: $root/$script not found; run pluginfinity build" >&2
		return 1
	fi
	case "$script" in skills/*) kind=skill ;; esac
	if [ -z "$interp" ]; then
		case "$script" in
		*.mjs | *.cjs | *.js) interp=node ;;
		*) interp=bash ;;
		esac
	fi
	# The command is word-split on purpose, so --interpreter 'bash -x' works.
	local cmd
	read -r -a cmd <<<"$interp"
	_pf_host_env "$target" "$root" "$kind" || {
		echo "run_script: unknown target $target" >&2
		return 1
	}
	if [ -n "$kind" ]; then
		[ -n "$cwd" ] || cwd=$(_pf_project_dir)
		mkdir -p "$cwd"
	else
		[ -n "$cwd" ] || { [ "$target" = copilot ] && cwd=$root; }
	fi
	if [ -n "$cwd" ]; then
		run --separate-stderr env -i "${_pf_env[@]}" ${filevars[@]+"${filevars[@]}"} ${vars[@]+"${vars[@]}"} bash -c 'cd "$1" && shift && exec "$@"' _ "$cwd" "${cmd[@]}" "$root/$script" ${args[@]+"${args[@]}"} <"$stdin"
	else
		run --separate-stderr env -i "${_pf_env[@]}" ${filevars[@]+"${filevars[@]}"} ${vars[@]+"${vars[@]}"} "${cmd[@]}" "$root/$script" ${args[@]+"${args[@]}"} <"$stdin"
	fi
}

# _pf_run_bounded <seconds> <name> <command...>: run <command...> in its own
# process group and kill the group when <seconds> pass, then exit 124 with a
# message on stderr. bash 3.2 has no setsid or timeout, so `set -m` gives the
# background job its own group. Leaves no process behind.
_pf_run_bounded() {
	local secs=$1 name=$2 job dog rc flag
	shift 2
	flag="$BATS_TEST_TMPDIR/.timeout-$$-$RANDOM"
	set -m
	"$@" &
	job=$!
	(
		sleep "$secs"
		: >"$flag"
		kill -TERM -- "-$job" 2>/dev/null
		sleep 1
		kill -KILL -- "-$job" 2>/dev/null
	) &
	dog=$!
	rc=0
	wait "$job" || rc=$?
	kill -KILL -- "-$dog" 2>/dev/null
	wait "$dog" 2>/dev/null || :
	# A job that ignored TERM may have been killed by the watchdog's KILL.
	kill -KILL -- "-$job" 2>/dev/null || :
	set +m
	if [ -e "$flag" ]; then
		rm -f "$flag"
		echo "run_monitor: $name timed out after ${secs}s" >&2
		return 124
	fi
	return "$rc"
}

# run_monitor <target> <name> [--ticks <n>] [--timeout <seconds>] [--cwd <dir>] [VAR=value...]
# Runs the monitor's command from builds/claude/monitors/monitors.json the way
# Claude does: from --cwd (default $BATS_TEST_TMPDIR/project, created, standing
# in for the session's project dir), with ${CLAUDE_PLUGIN_ROOT} substituted into
# the command text and none of CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT,
# CLAUDE_PLUGIN_DATA or CLAUDE_SESSION_ID in the environment (a monitor does get
# CLAUDE_CODE_SESSION_ID, set to "test-session"). Stdin is /dev/null.
# PLUGINFINITY_MONITOR_MAX_TICKS is set to <n> (default 1): every monitor must
# honour it, stopping after that many checks, however triggered, a node
# `command` monitor included. --timeout (default 30) is a wall-clock bound: the
# monitor's process group is killed after that many seconds and $status is 124,
# with `run_monitor: <name> timed out after <s>s` on stderr, so a monitor that
# never reaches its tick count fails the test instead of hanging bats. A target
# other than claude fails with status 1 and a message on stderr. Sets $status,
# $output and $stderr.
run_monitor() {
	local target=$1 name=$2 ticks=1 cwd="" timeout=30
	shift 2
	if [ "$target" != claude ]; then
		run --separate-stderr bash -c 'echo "run_monitor: $1 has no monitors" >&2; exit 1' _ "$target"
		return 0
	fi
	while [ $# -gt 0 ]; do
		case "$1" in
		--ticks)
			ticks=$2
			shift 2
			;;
		--timeout)
			case "${2:-}" in
			'' | *[!0-9]*)
				run --separate-stderr bash -c 'echo "run_monitor: --timeout needs a number of seconds, got $1" >&2; exit 1' _ "'${2:-}'"
				return 0
				;;
			esac
			timeout=$2
			shift 2
			;;
		--cwd)
			cwd=$2
			shift 2
			;;
		*) break ;;
		esac
	done
	local root="$PLUGIN_DIR/builds/claude" command
	command=$(jq -r --arg n "$name" '[.[] | select(.name == $n)][0].command // empty' "$root/monitors/monitors.json" 2>/dev/null)
	if [ -z "$command" ]; then
		run --separate-stderr bash -c 'echo "run_monitor: no monitor $1" >&2; exit 1' _ "$name"
		return 0
	fi
	local token='${CLAUDE_PLUGIN_ROOT}'
	command=${command//"$token"/"$root"}
	[ -n "$cwd" ] || cwd=$(_pf_project_dir)
	mkdir -p "$cwd"
	run --separate-stderr _pf_run_bounded "$timeout" "$name" \
		env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" \
		XDG_STATE_HOME="$BATS_TEST_TMPDIR/state" CLAUDE_CODE_SESSION_ID=test-session \
		PLUGINFINITY_MONITOR_MAX_TICKS="$ticks" "$@" \
		bash -c 'cd "$1" && exec bash -c "$2"' _ "$cwd" "$command" </dev/null
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
	jq -n --arg e "$1" --arg cwd "$(_pf_project_dir)" --argjson o "$overrides" \
		'{session_id: "test-session", transcript_path: "/dev/null", cwd: $cwd, hook_event_name: $e} + $o' >"$file"
	printf '%s\n' "$file"
}
