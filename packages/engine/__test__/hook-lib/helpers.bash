# shellcheck shell=bash
# Helpers for the hook library's own suite: a fake build root holding the
# library and a host.sh, and a runner that executes a hook script under env -i.

bats_require_minimum_version 1.5.0

LIB_SRC="$BATS_TEST_DIRNAME/../../hook-lib"
FIXTURES="$BATS_TEST_DIRNAME/../fixtures/hooks"

# make_plugin <host> [plugin-name]: a fake build root at $PLUGIN.
make_plugin() {
	PLUGIN="$BATS_TEST_TMPDIR/plugin $1"
	mkdir -p "$PLUGIN/hooks/lib/pluginfinity"
	cp "$LIB_SRC"/*.sh "$PLUGIN/hooks/lib/pluginfinity/"
	printf "PLUGINFINITY_HOST=%s\nPLUGINFINITY_PLUGIN='%s'\nPLUGINFINITY_LIB_VERSION=0.0.0-test\n" \
		"$1" "${2:-fixture}" >"$PLUGIN/hooks/lib/pluginfinity/host.sh"
}

# hook_script <body>: write $PLUGIN/hooks/test.sh, which sources the library then runs <body>.
hook_script() {
	{
		printf '#!/usr/bin/env bash\nset -euo pipefail\n. "$(dirname "$0")/lib/pluginfinity/hook.sh"\n'
		printf '%s\n' "$1"
	} >"$PLUGIN/hooks/test.sh"
}

# run_script <fixture-file-or-json> [VAR=value...]: run the script with stdin
# from the fixture, under env -i, with $BASH_UNDER_TEST (default: bash).
run_script() {
	local input=$1
	shift
	if [ ! -f "$input" ]; then
		printf '%s' "$input" >"$BATS_TEST_TMPDIR/input.json"
		input="$BATS_TEST_TMPDIR/input.json"
	fi
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" \
		XDG_STATE_HOME="$BATS_TEST_TMPDIR/state" "$@" \
		"${BASH_UNDER_TEST:-bash}" "$PLUGIN/hooks/test.sh" <"$input"
}

# error_log / debug_log: the plugin's log files under the test's state dir.
error_log() { cat "$BATS_TEST_TMPDIR/state/pluginfinity/${1:-fixture}/hook-error.log" 2>/dev/null; }
debug_log() { cat "$BATS_TEST_TMPDIR/state/pluginfinity/${1:-fixture}/hook-debug.log" 2>/dev/null; }

# no_jq_path: a PATH holding every tool the library needs except jq.
no_jq_path() {
	local dir="$BATS_TEST_TMPDIR/nojq" tool
	mkdir -p "$dir"
	for tool in bash cat dirname basename date mkdir env; do
		ln -sf "$(command -v "$tool")" "$dir/$tool"
	done
	printf '%s\n' "$dir"
}
