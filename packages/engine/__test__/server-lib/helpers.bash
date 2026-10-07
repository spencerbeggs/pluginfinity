# shellcheck shell=bash
bats_require_minimum_version 1.5.0
LIB_SRC="$BATS_TEST_DIRNAME/../../server-lib"
LOG_SRC="$BATS_TEST_DIRNAME/../../log-lib"

# Physical (symlink-free) path: sh derives PWD physically, and on macOS
# $BATS_TEST_TMPDIR sits under /var, a symlink to /private/var.
physical() { (cd "$1" && pwd -P); }

# make_build <host>: a fake build root at $BUILD holding the library and a launcher.
make_build() {
	TMP=$(physical "$BATS_TEST_TMPDIR")
	mkdir -p "$TMP/build $1"
	BUILD=$(physical "$TMP/build $1")
	mkdir -p "$BUILD/lib/pluginfinity" "$BUILD/bin"
	cp "$LIB_SRC/server.sh" "$LOG_SRC/log.sh" "$BUILD/lib/pluginfinity/"
	printf "PLUGINFINITY_HOST=%s\nPLUGINFINITY_PLUGIN='fixture'\nPLUGINFINITY_LIB_VERSION=0.0.0-test\n" \
		"$1" >"$BUILD/lib/pluginfinity/host.sh"
	HOST=$1
}

# launcher <body>: write $BUILD/bin/launch.sh, which sources the library then runs <body>.
launcher() {
	printf '#!/bin/sh\nset -eu\n. "$PLUGINFINITY_LIB/server.sh"\n%s\n' "$1" >"$BUILD/bin/launch.sh"
}

# run_launcher [VAR=value...]: run it under env -i from $PWD, with the injected env.
run_launcher() {
	# A suite that stubs the runners puts $TMP/stub first; make sure of it.
	case "$PATH" in "$TMP/stub:"*) ;; *) [ ! -d "$TMP/stub" ] || PATH="$TMP/stub:$PATH" ;; esac
	run --separate-stderr env -i PATH="$PATH" HOME="$TMP/home" \
		XDG_STATE_HOME="$TMP/state" PLUGINFINITY_HOST="$HOST" \
		PLUGINFINITY_PLUGIN=fixture PLUGINFINITY_LIB="$BUILD/lib/pluginfinity" "$@" \
		"${SH_UNDER_TEST:-sh}" "$BUILD/bin/launch.sh"
}
