# shellcheck shell=bash
# Helpers for the session env suite: a fake build root holding log.sh, host.sh,
# env.sh (with its declarations block filled in) and env-run.sh, a project
# directory, and runners for SessionStart and for a reader script.
bats_require_minimum_version 1.5.0
ENV_SRC="$BATS_TEST_DIRNAME/../../env-lib"
LOG_SRC="$BATS_TEST_DIRNAME/../../log-lib"

# make_root <host> <plugin> <declarations...>: a build root at $ROOT and a git project at $PROJECT.
# Each declaration is NAME or NAME=default. SETUP and TIMEOUT (env vars) fill the setup path and bound.
make_root() {
	local host=$1 plugin=$2 decl names="" block
	shift 2
	ROOT="$BATS_TEST_TMPDIR/root"
	STATE="$BATS_TEST_TMPDIR/state"
	PROJECT="$BATS_TEST_TMPDIR/project"
	mkdir -p "$ROOT/lib/pluginfinity" "$ROOT/skills/x/scripts" "$PROJECT/.git" "$PROJECT/sub"
	PROJECT=$(cd "$PROJECT" && pwd -P)
	cp "$LOG_SRC/log.sh" "$ENV_SRC/env-run.sh" "$ROOT/lib/pluginfinity/"
	printf "PLUGINFINITY_HOST=%s\nPLUGINFINITY_PLUGIN='%s'\nPLUGINFINITY_LIB_VERSION=0.0.0-test\n" \
		"$host" "$plugin" >"$ROOT/lib/pluginfinity/host.sh"
	block="$BATS_TEST_TMPDIR/block"
	: >"$block"
	for decl in "$@"; do
		names="$names${names:+ }${decl%%=*}"
		if [ "$decl" != "${decl%%=*}" ]; then printf "_pf_env_default_%s='%s'\n" "${decl%%=*}" "${decl#*=}" >>"$block"; fi
	done
	{
		printf "_pf_env_names='%s'\n" "$names"
		printf "_pf_env_setup='%s'\n" "${SETUP:-}"
		printf "_pf_env_setup_timeout=%s\n" "${TIMEOUT:-10}"
	} >>"$block"
	awk -v block="$block" '
		/^# >>> pluginfinity env declarations/ { print; while ((getline line < block) > 0) print line; skip = 1; next }
		/^# <<< pluginfinity env declarations/ { skip = 0 }
		!skip { print }
	' "$ENV_SRC/env.sh" >"$ROOT/lib/pluginfinity/env.sh"
}

# setup_script <body>: write the plugin's setup script at $ROOT/scripts/setup.sh.
setup_script() {
	mkdir -p "$ROOT/scripts"
	printf '%s\n' "$1" >"$ROOT/scripts/setup.sh"
}

# session_start <session id> <cwd> [VAR=value...]: run env-run.sh with a Claude-style event under env -i.
session_start() {
	local sid=$1 cwd=$2
	shift 2
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$STATE" "$@" \
		"${SH_UNDER_TEST:-sh}" -c 'printf "%s" "$1" | "$2" "$3"' _ \
		"{\"session_id\":\"$sid\",\"cwd\":\"$cwd\",\"source\":\"startup\"}" "${SH_UNDER_TEST:-sh}" \
		"$ROOT/lib/pluginfinity/env-run.sh"
}

# session_start_raw <json> [VAR=value...]: run env-run.sh with <json> on stdin.
session_start_raw() {
	local json=$1
	shift
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$STATE" "$@" \
		"${SH_UNDER_TEST:-sh}" -c 'printf "%s" "$1" | "$2" "$3"' _ "$json" "${SH_UNDER_TEST:-sh}" \
		"$ROOT/lib/pluginfinity/env-run.sh"
}

# reader <body>: a skill script that sources env.sh the documented way, then runs <body>.
reader() {
	printf '#!/bin/sh\n_pf_lib_dir="$(dirname "$0")/../../../lib/pluginfinity"; . "$_pf_lib_dir/env.sh"\n%s\n' "$1" \
		>"$ROOT/skills/x/scripts/run.sh"
}

# read_in <dir> [VAR=value...]: run the reader script with cwd <dir> under env -i.
read_in() {
	local dir=$1
	shift
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$STATE" "$@" \
		"${SH_UNDER_TEST:-sh}" -c 'cd "$1" && exec "$2" "$3"' _ "$dir" "${SH_UNDER_TEST:-sh}" "$ROOT/skills/x/scripts/run.sh"
}

# values <session id>: the session values file.
values() { cat "$STATE/pluginfinity/fx/session/$1/env"; }

# errlog: the plugin's error log, or nothing.
errlog() { cat "$STATE/pluginfinity/fx/error.log" 2>/dev/null || :; }
