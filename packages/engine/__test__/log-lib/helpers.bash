# shellcheck shell=bash
# Helpers for the logging library's suite: a fake build root holding log.sh and
# host.sh, and a skill script that sources log.sh the documented way.
bats_require_minimum_version 1.5.0
LOG_SRC="$BATS_TEST_DIRNAME/../../log-lib"

# make_root <host> <plugin>: a fake build root at $ROOT with log.sh, host.sh and a skill script.
make_root() {
	ROOT="$BATS_TEST_TMPDIR/root"
	STATE="$BATS_TEST_TMPDIR/state"
	mkdir -p "$ROOT/lib/pluginfinity" "$ROOT/skills/x/scripts"
	cp "$LOG_SRC/log.sh" "$ROOT/lib/pluginfinity/"
	printf "PLUGINFINITY_HOST=%s\nPLUGINFINITY_PLUGIN='%s'\nPLUGINFINITY_LIB_VERSION=0.0.0-test\n" \
		"$1" "$2" >"$ROOT/lib/pluginfinity/host.sh"
}

# script_body <body>: write $ROOT/skills/x/scripts/run.sh, which sources log.sh then runs <body>.
script_body() {
	printf '#!/bin/sh\n_pf_log_dir="$(dirname "$0")/../../../lib/pluginfinity"; . "$_pf_log_dir/log.sh"\n%s\n' "$1" \
		>"$ROOT/skills/x/scripts/run.sh"
}

# run_it [VAR=value...]: run the script under env -i with a private state dir.
run_it() {
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$STATE" "$@" \
		"${SH_UNDER_TEST:-sh}" "$ROOT/skills/x/scripts/run.sh"
}
