# shellcheck shell=bash
# Helpers for the monitor library's suite: a fake build root holding log.sh, host.sh
# and monitor.sh, and a monitor script that sources monitor.sh the documented way.
bats_require_minimum_version 1.5.0
MONITOR_SRC="$BATS_TEST_DIRNAME/../../monitor-lib"
LOG_SRC="$BATS_TEST_DIRNAME/../../log-lib"

# make_root <host> <plugin>: a fake build root at $ROOT.
make_root() {
	ROOT="$BATS_TEST_TMPDIR/root"
	STATE="$BATS_TEST_TMPDIR/state"
	mkdir -p "$ROOT/lib/pluginfinity" "$ROOT/monitors"
	cp "$LOG_SRC/log.sh" "$MONITOR_SRC/monitor.sh" "$ROOT/lib/pluginfinity/"
	printf "PLUGINFINITY_HOST=%s\nPLUGINFINITY_PLUGIN='%s'\nPLUGINFINITY_LIB_VERSION=0.0.0-test\n" \
		"$1" "$2" >"$ROOT/lib/pluginfinity/host.sh"
}

# monitor_body <body>: write $ROOT/monitors/m.sh, which sources monitor.sh then runs <body>.
monitor_body() {
	printf '#!/bin/sh\n_pf_lib_dir="$(dirname "$0")/../lib/pluginfinity"; . "$_pf_lib_dir/monitor.sh"\n%s\n' "$1" \
		>"$ROOT/monitors/m.sh"
}

# run_it [VAR=value...]: run the monitor under env -i with a private state dir.
run_it() {
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$STATE" "$@" \
		"${SH_UNDER_TEST:-sh}" "$ROOT/monitors/m.sh"
}
