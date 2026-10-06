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

# run_hook <target> <script> <fixture> [VAR=value...]
# Runs builds/<target>/<script> under env -i with the host's environment and
# the fixture on stdin. Sets $status, $output and $stderr.
run_hook() {
	local target=$1 script=$2 fixture=$3
	shift 3
	local root="$PLUGIN_DIR/builds/$target"
	if [ ! -f "$root/$script" ]; then
		echo "run_hook: $root/$script not found; run pluginfinity build" >&2
		return 1
	fi
	case "$fixture" in
	/*) ;;
	*) fixture="$PLUGIN_DIR/__test__/fixtures/$fixture" ;;
	esac
	local event
	event=$(jq -r '.hook_event_name // empty' "$fixture")
	case "$target" in
	claude)
		run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" \
			XDG_STATE_HOME="$BATS_TEST_TMPDIR/state" CLAUDE_PLUGIN_ROOT="$root" \
			CLAUDE_PROJECT_DIR="${HOOK_PROJECT_DIR:-$BATS_TEST_TMPDIR}" "$@" bash "$root/$script" <"$fixture"
		;;
	copilot)
		# Copilot runs hooks from the plugin root, and the build sets
		# PLUGINFINITY_EVENT on every entry.
		run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" \
			XDG_STATE_HOME="$BATS_TEST_TMPDIR/state" PLUGIN_ROOT="$root" \
			PLUGINFINITY_EVENT="$event" "$@" bash -c 'cd "$1" && shift && exec bash "$@"' _ "$root" "$root/$script" <"$fixture"
		;;
	*)
		echo "run_hook: unknown target $target" >&2
		return 1
		;;
	esac
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
