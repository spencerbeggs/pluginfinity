# shellcheck shell=bash
# Helpers for the hook library's own suite: a fake build root holding the
# library and a host.sh, and a runner that executes a hook script under env -i.

bats_require_minimum_version 1.5.0

LIB_SRC="$BATS_TEST_DIRNAME/../../hook-lib"
LOG_SRC="$BATS_TEST_DIRNAME/../../log-lib"
FIXTURES="$BATS_TEST_DIRNAME/../fixtures/hooks"

# make_plugin <host> [plugin-name] [tools.sh text]: a fake build root at $PLUGIN.
make_plugin() {
	PLUGIN="$BATS_TEST_TMPDIR/plugin $1"
	mkdir -p "$PLUGIN/hooks/lib/pluginfinity" "$PLUGIN/lib/pluginfinity"
	cp "$LIB_SRC"/*.sh "$PLUGIN/hooks/lib/pluginfinity/"
	cp "$LOG_SRC"/*.sh "$PLUGIN/lib/pluginfinity/"
	printf "PLUGINFINITY_HOST=%s\nPLUGINFINITY_PLUGIN='%s'\nPLUGINFINITY_LIB_VERSION=0.0.0-test\n" \
		"$1" "${2:-fixture}" >"$PLUGIN/hooks/lib/pluginfinity/host.sh"
	cp "$PLUGIN/hooks/lib/pluginfinity/host.sh" "$PLUGIN/lib/pluginfinity/host.sh"
	if [ -n "${3:-}" ]; then
		printf '%s\n' "$3" >"$PLUGIN/hooks/lib/pluginfinity/tools.sh"
	else
		printf "_PF_TOOLS=''\n_PF_TOOLS_MCP=''\n_PF_TOOLS_SERVERS=''\n_PF_TOOLS_UNLISTED=keep\n" >"$PLUGIN/hooks/lib/pluginfinity/tools.sh"
	fi
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
error_log() { cat "$BATS_TEST_TMPDIR/state/pluginfinity/${1:-fixture}/error.log" 2>/dev/null; }
debug_log() { cat "$BATS_TEST_TMPDIR/state/pluginfinity/${1:-fixture}/debug.log" 2>/dev/null; }

# no_jq_path: a PATH holding every tool the library needs except jq.
no_jq_path() {
	local dir="$BATS_TEST_TMPDIR/nojq" tool
	mkdir -p "$dir"
	for tool in bash cat dirname basename date mkdir env; do
		ln -sf "$(command -v "$tool")" "$dir/$tool"
	done
	printf '%s\n' "$dir"
}

ENV_SRC="$BATS_TEST_DIRNAME/../../env-lib"

# make_env <declarations...>: add the session env library to the fake build root.
# Each declaration is NAME or NAME=default. The declarations block is filled in
# the way the build does it. The state dir is $BATS_TEST_TMPDIR/state.
make_env() {
	local decl names="" block="$BATS_TEST_TMPDIR/env-block"
	: >"$block"
	for decl in "$@"; do
		names="$names${names:+ }${decl%%=*}"
		if [ "$decl" != "${decl%%=*}" ]; then printf "_pf_env_default_%s='%s'\n" "${decl%%=*}" "${decl#*=}" >>"$block"; fi
	done
	{
		printf "_pf_env_names='%s'\n_pf_env_setup=''\n_pf_env_setup_timeout=10\n" "$names"
	} >>"$block"
	awk -v block="$block" '
		/^# >>> pluginfinity env declarations/ { print; while ((getline line < block) > 0) print line; skip = 1; next }
		/^# <<< pluginfinity env declarations/ { skip = 0 }
		!skip { print }
	' "$ENV_SRC/env.sh" >"$PLUGIN/lib/pluginfinity/env.sh"
}

# seed_env <session id> NAME=value...: write the library's values file for a session.
seed_env() {
	local sid=$1 dir
	shift
	dir="$BATS_TEST_TMPDIR/state/pluginfinity/${PLUGIN_NAME:-fixture}/session/$sid"
	mkdir -p "$dir"
	printf '%s\n' "$@" >"$dir/env"
}

values_file() { cat "$BATS_TEST_TMPDIR/state/pluginfinity/${PLUGIN_NAME:-fixture}/session/${1:-s-1}/env" 2>/dev/null; }
