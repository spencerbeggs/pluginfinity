# shellcheck shell=bash
load helpers

# --- the runner ------------------------------------------------------------

@test "SessionStart writes every declared default and prints nothing" {
	make_root claude fx A=one B
	session_start s1 "$PROJECT" CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/envfile"
	[ "$status" -eq 0 ] && [ -z "$output" ] && [ -z "$stderr" ]
	[ "$(values s1)" = "$(printf 'A=one\nB=')" ]
}

@test "setup output outranks the default" {
	SETUP=scripts/setup.sh make_root claude fx A=one
	setup_script 'echo A=from-setup'
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "A=from-setup" ]
}

@test ".env outranks setup, .env.local outranks .env" {
	SETUP=scripts/setup.sh make_root claude fx A B C=c
	setup_script 'printf "A=setup\nB=setup\n"'
	printf 'A=dotenv\nB=dotenv\n' >"$PROJECT/.env"
	printf 'B=local\n' >"$PROJECT/.env.local"
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "$(printf 'A=dotenv\nB=local\nC=c')" ]
}

@test "the ambient environment outranks .env.local" {
	make_root claude fx A
	printf 'A=local\n' >"$PROJECT/.env.local"
	session_start s1 "$PROJECT" A=ambient
	[ "$(values s1)" = "A=ambient" ]
	session_start s2 "$PROJECT" A=
	[ "$(values s2)" = "A=" ]
}

@test "the project is the event's cwd walked up to .git" {
	make_root claude fx A
	printf 'A=root\n' >"$PROJECT/.env"
	printf 'A=sub\n' >"$PROJECT/sub/.env"
	session_start s1 "$PROJECT/sub"
	[ "$(values s1)" = "A=root" ]
}

@test "setup runs under bash in the project with PLUGINFINITY_EVENT and the event on stdin" {
	SETUP=scripts/setup.sh make_root claude fx WHERE EVENT INPUT
	setup_script 'echo "WHERE=$(pwd -P)"; echo "EVENT=$PLUGINFINITY_EVENT"; echo "INPUT=$(cat)"; [[ -n "${BASH_VERSION:-}" ]] || echo WHERE=not-bash'
	session_start s1 "$PROJECT/sub"
	values s1 | grep -qx "WHERE=$PROJECT"
	values s1 | grep -qx "EVENT=SessionStart"
	values s1 | grep -q '^INPUT={"session_id":"s1"'
}

@test "setup lines: blank and # skipped, values literal, later lines win" {
	SETUP=scripts/setup.sh make_root claude fx A B
	setup_script 'printf "\n# A=no\nA=x\nA=a b=c \$HOME\nB=\nnot a line\n"'
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "$(printf 'A=a b=c $HOME\nB=')" ]
}

@test "an undeclared name from setup is skipped with one log line, its value never logged" {
	SETUP=scripts/setup.sh make_root claude fx A
	setup_script 'printf "A=a\nSECRET=hunter2\n"'
	session_start s1 "$PROJECT" CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/envfile"
	[ "$(values s1)" = "A=a" ]
	[[ "$(errlog)" == *"hook/env-run.sh: env: setup printed SECRET, which is not declared; skipped"* ]]
	! grep -q hunter2 "$STATE/pluginfinity/fx/error.log" "$BATS_TEST_TMPDIR/envfile"
}

@test "a setup that times out keeps nothing and logs" {
	SETUP=scripts/setup.sh TIMEOUT=1 make_root claude fx A=default
	setup_script 'echo A=early; exec sleep 5'
	session_start s1 "$PROJECT"
	[ "$status" -eq 0 ] && [ -z "$output" ] && [ -z "$stderr" ]
	[ "$(values s1)" = "A=default" ]
	[[ "$(errlog)" == *"setup script scripts/setup.sh timed out after 1s; its output is discarded"* ]]
}

@test "a setup that exits non-zero keeps its valid lines and logs" {
	SETUP=scripts/setup.sh make_root claude fx A=default
	setup_script 'echo A=kept; exit 3'
	session_start s1 "$PROJECT"
	[ "$status" -eq 0 ]
	[ "$(values s1)" = "A=kept" ]
	[[ "$(errlog)" == *"setup script scripts/setup.sh exited 3; keeping its valid lines"* ]]
}

@test "a missing setup script is logged and the chain still resolves" {
	SETUP=scripts/nope.sh make_root claude fx A=default
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "A=default" ]
	[[ "$(errlog)" == *"setup script scripts/nope.sh is missing; skipped"* ]]
}

@test ".env: export prefix, quotes stripped, nothing expanded, comments and junk skipped" {
	make_root claude fx A B C D E F
	printf '%s\n' '# A=comment' 'export A=exported' '  B="double quoted # x"' "C='single \$HOME'" 'D=$HOME' \
		'E = spaced' 'F="unbalanced' 'garbage' >"$PROJECT/.env"
	printf 'E=crlf\r\n' >>"$PROJECT/.env"
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "$(printf '%s\n' 'A=exported' 'B=double quoted # x' 'C=single $HOME' 'D=$HOME' 'E=crlf' 'F="unbalanced')" ]
}

@test "an undeclared secret in .env reaches no file, no export and no log" {
	make_root claude fx A
	printf 'A=a\nAWS_SECRET_ACCESS_KEY=hunter2\n' >"$PROJECT/.env"
	session_start s1 "$PROJECT" CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/envfile"
	[ "$(values s1)" = "A=a" ]
	! grep -rq hunter2 "$STATE" "$BATS_TEST_TMPDIR/envfile"
	reader 'printf "%s\n" "${AWS_SECRET_ACCESS_KEY-unset}"'
	read_in "$PROJECT"
	[ "$output" = unset ]
}

@test "an unreadable .env is logged and skipped" {
	make_root claude fx A=default
	mkdir "$PROJECT/.env"
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "A=default" ]
	[[ "$(errlog)" == *"env: cannot read $PROJECT/.env; skipped"* ]]
}

@test "a session id with / or .. writes nothing anywhere and logs" {
	make_root claude fx A=default
	for sid in '../../escape' 'a/b' '..' '.' 'x..y' 'a\\b'; do
		session_start "$sid" "$PROJECT"
		[ "$status" -eq 0 ] && [ -z "$output" ]
	done
	[ ! -e "$STATE/pluginfinity/fx/session" ]
	[ ! -e "$STATE/pluginfinity/escape" ] && [ ! -e "$STATE/escape" ]
	[ ! -e "$STATE/pluginfinity/fx/project" ]
	[[ "$(errlog)" == *"env: invalid session id; session values not written"* ]]
}

@test "a session id with a control character is refused" {
	make_root claude fx A=default
	session_start 's1\u0001' "$PROJECT"
	[ ! -e "$STATE/pluginfinity/fx/session" ]
	[[ "$(errlog)" == *"invalid session id"* ]]
}

@test "an event with no session id is logged and writes no values" {
	make_root claude fx A=default
	session_start_raw '{"cwd":"/tmp"}'
	[ "$status" -eq 0 ] && [ -z "$output" ]
	[ ! -e "$STATE/pluginfinity/fx/session" ]
	[[ "$(errlog)" == *"the event has no session id"* ]]
}

@test "a Copilot camelCase event names the session" {
	make_root copilot fx A=default
	session_start_raw "{\"sessionId\":\"c1\",\"cwd\":\"$PROJECT\",\"source\":\"new\"}"
	[ "$(values c1)" = "A=default" ]
}

@test "malformed stdin still writes nothing to stdout" {
	make_root claude fx A=default
	session_start_raw 'not json'
	[ "$status" -eq 0 ] && [ -z "$output" ]
}

@test "Claude appends export lines to CLAUDE_ENV_FILE, quoting single quotes" {
	SETUP=scripts/setup.sh make_root claude fx A B
	setup_script "echo \"A=it's \\\$x\""
	printf 'export EARLIER=1\n' >"$BATS_TEST_TMPDIR/envfile"
	session_start s1 "$PROJECT" CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/envfile"
	[ "$(cat "$BATS_TEST_TMPDIR/envfile")" = "$(printf '%s\n' 'export EARLIER=1' "export A='it'\\''s \$x'" "export B=''")" ]
	run bash -c ". '$BATS_TEST_TMPDIR/envfile'; printf '%s' \"\$A\""
	[ "$output" = "it's \$x" ]
}

@test "Claude with no CLAUDE_ENV_FILE logs and still writes the values" {
	make_root claude fx A=default
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "A=default" ]
	[[ "$(errlog)" == *"CLAUDE_ENV_FILE is not set"* ]]
}

@test "Copilot never writes CLAUDE_ENV_FILE, even when it is set" {
	make_root copilot fx A=default
	session_start s1 "$PROJECT" CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/envfile"
	[ ! -e "$BATS_TEST_TMPDIR/envfile" ]
	[ "$(values s1)" = "A=default" ]
	[ -z "$(errlog)" ]
}

@test "a SessionStart with a new session id starts a fresh values file" {
	SETUP=scripts/setup.sh make_root claude fx A=default
	setup_script 'echo A=first'
	session_start s1 "$PROJECT"
	setup_script 'echo A=second'
	session_start s2 "$PROJECT"
	[ "$(values s1)" = "A=first" ] && [ "$(values s2)" = "A=second" ]
}

# --- readers ----------------------------------------------------------------

@test "a script with no session id reads the latest session of its own project" {
	make_root claude fx A
	other="$BATS_TEST_TMPDIR/other"
	mkdir -p "$other/.git"
	other=$(cd "$other" && pwd -P)
	session_start s1 "$PROJECT" A=first
	session_start s2 "$PROJECT" A=second
	session_start s3 "$other" A=other-project
	reader 'printf "%s\n" "$A"'
	read_in "$PROJECT/sub"
	[ "$status" -eq 0 ] && [ "$output" = second ] && [ -z "$stderr" ]
	read_in "$other"
	[ "$output" = other-project ]
}

@test "the session file outranks the reader's own ambient value (resolve once)" {
	SETUP=scripts/setup.sh make_root claude fx A
	setup_script 'echo A=setup'
	printf 'A=dotenv\n' >"$PROJECT/.env"
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "A=dotenv" ]
	reader 'printf "%s\n" "$A"'
	# Claude passes the setup value into later processes; it must not win over .env.
	read_in "$PROJECT" A=setup
	[ "$output" = dotenv ]
}

@test "a pointer naming another directory (a hash collision) is ignored" {
	make_root claude fx A=default
	session_start s1 "$PROJECT" A=from-session
	ptr=$(ls "$STATE/pluginfinity/fx/project/")
	printf 's1\n/some/other/dir\n' >"$STATE/pluginfinity/fx/project/$ptr"
	reader 'printf "%s\n" "$A"'
	read_in "$PROJECT"
	[ "$output" = default ]
}

@test "a pointer naming an invalid session id is ignored" {
	make_root claude fx A=default
	session_start s1 "$PROJECT" A=from-session
	ptr=$(ls "$STATE/pluginfinity/fx/project/")
	printf '../s1\n%s\n' "$PROJECT" >"$STATE/pluginfinity/fx/project/$ptr"
	reader 'printf "%s\n" "$A"'
	read_in "$PROJECT"
	[ "$output" = default ]
}

@test "with no session at all a reader resolves live: default, .env, .env.local, ambient" {
	make_root claude fx A=default B=default C=default D=default
	printf 'B=dotenv\nC=dotenv\n' >"$PROJECT/.env"
	printf 'C=local\n' >"$PROJECT/.env.local"
	reader 'printf "%s %s %s %s\n" "$A" "$B" "$C" "$D"'
	read_in "$PROJECT/sub" D=ambient
	[ "$output" = "default dotenv local ambient" ]
}

@test "values are exported to the reader's children" {
	make_root claude fx A=default
	reader 'sh -c "printf %s \"\$A\""'
	read_in "$PROJECT"
	[ "$output" = default ]
}

@test "a reader under set -eu sources env.sh and keeps going" {
	make_root claude fx A=default
	printf '#!/bin/sh\nset -eu\n_pf_lib_dir="$(dirname "$0")/../../../lib/pluginfinity"; . "$_pf_lib_dir/env.sh"\necho "ok $A"\n' \
		>"$ROOT/skills/x/scripts/run.sh"
	read_in "$PROJECT"
	[ "$status" -eq 0 ] && [ "$output" = "ok default" ]
}

@test "undeclared names in the reader's environment are untouched" {
	make_root claude fx A=default
	printf 'OTHER=dotenv\n' >"$PROJECT/.env"
	reader 'printf "%s\n" "${OTHER-unset}"'
	read_in "$PROJECT"
	[ "$output" = unset ]
}

@test "a name declared after SessionStart resolves live while file values win" {
	make_root claude fx A
	session_start s1 "$PROJECT" A=session
	make_root claude fx A B=new-default
	reader 'printf "%s %s\n" "$A" "$B"'
	read_in "$PROJECT" A=ambient
	[ "$output" = "session new-default" ]
}

@test "no declared names: sourcing is a no-op" {
	make_root claude fx
	reader 'echo ok'
	read_in "$PROJECT"
	[ "$output" = ok ] && [ -z "$stderr" ]
}

# --- the caller contract (env_load, env_reload, _pf_env_set) ------------------

# manual <body>: a script that sources env.sh with _pf_env_manual=1, then runs <body>.
manual() {
	printf '#!/bin/sh\n_pf_env_manual=1\n_pf_lib_dir="$(dirname "$0")/../../../lib/pluginfinity"; . "$_pf_lib_dir/env.sh"\n%s\n' "$1" \
		>"$ROOT/skills/x/scripts/run.sh"
}

@test "_pf_env_manual=1 skips the automatic load" {
	make_root claude fx A=default
	manual 'printf "%s\n" "${A-unset}"'
	read_in "$PROJECT"
	[ "$output" = unset ]
}

@test "env_load with an explicit session id reads that session" {
	make_root claude fx A
	session_start s1 "$PROJECT" A=one
	session_start s2 "$PROJECT" A=two
	manual 'env_load s1 "$PWD"; printf "%s\n" "$A"'
	read_in "$PROJECT"
	[ "$output" = one ]
}

@test "env_load with a traversal session id reads nothing outside the state dir and logs" {
	make_root claude fx A=default
	mkdir -p "$STATE/pluginfinity/fx/escape"
	printf 'A=escaped\n' >"$STATE/pluginfinity/fx/escape/env"
	manual 'env_load "../escape/.." "$PWD"; env_load "../../fx/escape" "$PWD"; printf "%s\n" "$A"'
	read_in "$PROJECT"
	[ "$output" = default ]
	[[ "$(errlog)" == *"script/run.sh: env: invalid session id; session values not read"* ]]
}

@test "_pf_env_set updates the values file and the shell; env_reload reads it back" {
	make_root claude fx A B=b
	session_start s1 "$PROJECT" A=start
	manual 'env_load s1 "$PWD"; _pf_env_set A "new value" || exit 9; A=clobbered; env_reload; printf "%s|%s\n" "$A" "$B"'
	read_in "$PROJECT"
	[ "$status" -eq 0 ] && [ "$output" = "new value|b" ]
	[ "$(values s1)" = "$(printf 'A=new value\nB=b')" ]
}

@test "_pf_env_set on Claude appends to CLAUDE_ENV_FILE" {
	make_root claude fx A
	session_start s1 "$PROJECT"
	manual 'env_load s1 "$PWD"; _pf_env_set A "x'"'"'y"'
	read_in "$PROJECT" CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/envfile"
	[ "$(cat "$BATS_TEST_TMPDIR/envfile")" = "export A='x'\\''y'" ]
}

@test "_pf_env_set on Copilot leaves CLAUDE_ENV_FILE alone" {
	make_root copilot fx A
	session_start s1 "$PROJECT"
	manual 'env_load s1 "$PWD"; _pf_env_set A v; printf "%s\n" "$A"'
	read_in "$PROJECT" CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/envfile"
	[ "$output" = v ] && [ ! -e "$BATS_TEST_TMPDIR/envfile" ]
}

@test "_pf_env_set refuses an undeclared name, a newline and no session" {
	make_root claude fx A=default
	session_start s1 "$PROJECT"
	manual 'env_load s1 "$PWD"
_pf_env_set NOPE v && exit 1
_pf_env_set A "two
lines" && exit 2
env_load "" /nowhere
_pf_env_set A v && exit 3
echo refused'
	read_in "$PROJECT"
	[ "$output" = refused ]
	[ "$(values s1)" = "A=default" ]
	log=$(errlog)
	[[ "$log" == *"cannot set NOPE: not a declared session variable"* ]]
	[[ "$log" == *"cannot set A: the value holds a newline"* ]]
	[[ "$log" == *"cannot set A: no session"* ]]
}

@test "an unwritable state dir fails open" {
	make_root claude fx A=default
	session_start s1 "$PROJECT" XDG_STATE_HOME=/dev/null/nope
	[ "$status" -eq 0 ] && [ -z "$output" ]
	reader 'printf "%s\n" "$A"'
	read_in "$PROJECT" XDG_STATE_HOME=/dev/null/nope
	[ "$status" -eq 0 ] && [ "$output" = default ]
}

@test "a hostile .env or setup key is never evaluated" {
	SETUP=scripts/setup.sh make_root claude fx A=default
	setup_script "echo 'A;touch $PROJECT/pwned-setup=1'"
	printf 'A;touch %s/pwned-dotenv=1\nA B=1\n' "$PROJECT" >"$PROJECT/.env"
	session_start s1 "$PROJECT"
	reader 'printf "%s\n" "$A"'
	read_in "$PROJECT"
	[ "$output" = default ]
	[ -z "$(ls "$PROJECT" | grep pwned || :)" ]
}

@test "a setup timeout ends the setup's children too, a TERM-ignoring one included" {
	SETUP=scripts/setup.sh TIMEOUT=1 make_root claude fx A=default
	setup_script "sleep 23 & echo \$! >'$PROJECT/kid'; (trap '' TERM; exec sleep 24) & echo \$! >'$PROJECT/stubborn'; echo A=early; wait"
	session_start s1 "$PROJECT"
	[ "$status" -eq 0 ] && [ -z "$output" ] && [ -z "$stderr" ]
	[ "$(values s1)" = "A=default" ]
	kid=$(cat "$PROJECT/kid") stubborn=$(cat "$PROJECT/stubborn")
	[ -n "$kid" ] && [ -n "$stubborn" ]
	! kill -0 "$kid" 2>/dev/null
	! kill -0 "$stubborn" 2>/dev/null
}

@test "Copilot with no event cwd skips setup with a log line; defaults still resolve" {
	SETUP=scripts/setup.sh make_root copilot fx A=default
	setup_script "echo A=from-setup; touch '$BATS_TEST_TMPDIR/setup-ran'"
	session_start_raw '{"sessionId":"c1","source":"new"}'
	[ "$status" -eq 0 ] && [ -z "$output" ]
	[ "$(values c1)" = "A=default" ]
	[ ! -e "$BATS_TEST_TMPDIR/setup-ran" ]
	[[ "$(errlog)" == *"env: no project; setup script scripts/setup.sh skipped"* ]]
}

@test "the values file and its directories are private (umask 077)" {
	make_root claude fx A=default
	session_start s1 "$PROJECT" CLAUDE_ENV_FILE="$BATS_TEST_TMPDIR/envfile"
	[[ "$(ls -l "$STATE/pluginfinity/fx/session/s1/env")" == "-rw-------"* ]]
	[[ "$(ls -ld "$STATE/pluginfinity/fx/session/s1")" == "drwx------"* ]]
	[[ "$(ls -ld "$STATE/pluginfinity/fx/session")" == "drwx------"* ]]
}

# broken_jq: a PATH whose jq fails, so the runner falls back to its sed match.
broken_jq() {
	mkdir -p "$BATS_TEST_TMPDIR/shim"
	printf '#!/bin/sh\nexit 1\n' >"$BATS_TEST_TMPDIR/shim/jq"
	chmod +x "$BATS_TEST_TMPDIR/shim/jq"
	printf '%s' "$BATS_TEST_TMPDIR/shim:$PATH"
}

@test "without a working jq: the event still names the session and project" {
	make_root claude fx A
	printf 'A=dotenv\n' >"$PROJECT/.env"
	session_start s1 "$PROJECT/sub" PATH="$(broken_jq)"
	[ "$(values s1)" = "A=dotenv" ]
}

@test "without a working jq: an escaped control character in the session id is refused" {
	make_root claude fx A=default
	session_start 's1\u0001' "$PROJECT" PATH="$(broken_jq)"
	[ ! -e "$STATE/pluginfinity/fx/session" ]
	[[ "$(errlog)" == *"invalid session id"* ]]
}

# --- R13: SessionStart readers wait for the runner ----------------------------

# reader_bg <out> <sid>: start a SessionStart reader for session <sid> in the background.
reader_bg() {
	manual 'env_load "$1" "$PWD"; printf "%s\n" "$A"'
	env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$STATE" PLUGINFINITY_EVENT=SessionStart \
		"${SH_UNDER_TEST:-sh}" -c 'cd "$1" && exec "$2" "$3" "$4"' _ "$PROJECT" "${SH_UNDER_TEST:-sh}" \
		"$ROOT/skills/x/scripts/run.sh" "$2" >"$1" 2>&1 &
	READER=$!
}

@test "a SessionStart reader started before the runner sees the runner's values" {
	SETUP=scripts/setup.sh make_root claude fx A=default
	setup_script 'sleep 1; echo A=from-setup'
	reader_bg "$BATS_TEST_TMPDIR/out" s1
	session_start s1 "$PROJECT"
	wait "$READER"
	[ "$(cat "$BATS_TEST_TMPDIR/out")" = from-setup ]
	[[ "$(errlog)" != *"had not finished"* ]]
}

@test "a SessionStart reader gives up after 3s and resolves live with a log line" {
	make_root claude fx A=default
	printf 'A=dotenv\n' >"$PROJECT/.env"
	manual 'env_load s9 "$PWD"; printf "%s\n" "$A"'
	start=$SECONDS
	read_in "$PROJECT" PLUGINFINITY_EVENT=SessionStart
	[ "$output" = dotenv ]
	[ $((SECONDS - start)) -ge 2 ]
	[[ "$(errlog)" == *"env: the env runner had not finished after 3s; resolving live"* ]]
}

@test "a reader in any other event never waits" {
	make_root claude fx A=default
	manual 'env_load s9 "$PWD"; printf "%s\n" "$A"'
	start=$SECONDS
	read_in "$PROJECT" PLUGINFINITY_EVENT=PreToolUse
	[ "$output" = default ]
	[ $((SECONDS - start)) -lt 2 ]
	[[ "$(errlog)" != *"had not finished"* ]]
}

# --- R14: a same-id rerun keeps rung 6 ----------------------------------------

@test "a same-id SessionStart rerun keeps names set at rung 6 and re-resolves the rest" {
	SETUP=scripts/setup.sh make_root claude fx A B
	setup_script 'echo A=first; echo B=first'
	session_start s1 "$PROJECT"
	manual 'env_load s1 "$PWD"; _pf_env_set A from-hook'
	read_in "$PROJECT"
	[ "$(cat "$STATE/pluginfinity/fx/session/s1/set")" = A ]
	setup_script 'echo A=second; echo B=second'
	session_start s1 "$PROJECT"
	[ "$(values s1)" = "$(printf 'A=from-hook\nB=second')" ]
}

@test "a new session id does not inherit rung 6" {
	SETUP=scripts/setup.sh make_root claude fx A
	setup_script 'echo A=setup'
	session_start s1 "$PROJECT"
	manual 'env_load s1 "$PWD"; _pf_env_set A from-hook'
	read_in "$PROJECT"
	session_start s2 "$PROJECT"
	[ "$(values s2)" = "A=setup" ]
}

@test "_pf_env_set records a name once in the set file" {
	make_root claude fx A B
	session_start s1 "$PROJECT"
	manual 'env_load s1 "$PWD"; _pf_env_set A 1; _pf_env_set A 2; _pf_env_set B 3'
	read_in "$PROJECT"
	[ "$(cat "$STATE/pluginfinity/fx/session/s1/set")" = "$(printf 'A\nB')" ]
	[ "$(values s1)" = "$(printf 'A=2\nB=3')" ]
}

# --- R15: the lock -----------------------------------------------------------

@test "two concurrent _pf_env_set loops both land" {
	make_root claude fx A B
	session_start s1 "$PROJECT"
	manual 'env_load s1 "$PWD"; i=0; while [ "$i" -lt 25 ]; do i=$((i + 1)); _pf_env_set "$1" "$1$i"; done'
	for name in A B; do
		env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR/home" XDG_STATE_HOME="$STATE" \
			"${SH_UNDER_TEST:-sh}" -c 'cd "$1" && exec "$2" "$3" "$4"' _ "$PROJECT" "${SH_UNDER_TEST:-sh}" \
			"$ROOT/skills/x/scripts/run.sh" "$name" &
	done
	wait
	[ "$(values s1)" = "$(printf 'A=A25\nB=B25')" ]
	[ ! -e "$STATE/pluginfinity/fx/session/s1/lock" ]
}

@test "a stale lock is removed and the write proceeds" {
	make_root claude fx A
	session_start s1 "$PROJECT"
	mkdir "$STATE/pluginfinity/fx/session/s1/lock"
	echo $(($(date +%s) - 100)) >"$STATE/pluginfinity/fx/session/s1/lock/at"
	manual 'env_load s1 "$PWD"; _pf_env_set A v'
	start=$SECONDS
	read_in "$PROJECT"
	[ $((SECONDS - start)) -lt 2 ]
	[ "$(values s1)" = "A=v" ]
	[ ! -e "$STATE/pluginfinity/fx/session/s1/lock" ]
}

@test "a lock held past the retry bound is logged and the write proceeds (fail open)" {
	make_root claude fx A
	session_start s1 "$PROJECT"
	mkdir "$STATE/pluginfinity/fx/session/s1/lock"
	date +%s >"$STATE/pluginfinity/fx/session/s1/lock/at"
	manual 'env_load s1 "$PWD"; _pf_env_set A v'
	read_in "$PROJECT"
	[ "$status" -eq 0 ]
	[ "$(values s1)" = "A=v" ]
	[[ "$(errlog)" == *"env: the session values lock is held too long; writing without it"* ]]
	# Not ours to release.
	[ -d "$STATE/pluginfinity/fx/session/s1/lock" ]
}

@test "the runner writes its done marker" {
	make_root claude fx A=default
	session_start s1 "$PROJECT"
	[ -e "$STATE/pluginfinity/fx/session/s1/done" ]
}

@test "a setup timeout sends TERM to the setup's children first, so they can clean up" {
	SETUP=scripts/setup.sh TIMEOUT=1 make_root claude fx A=default
	setup_script "(trap 'touch \"$PROJECT/got-term\"; exit 0' TERM; sleep 23 & wait) & wait"
	session_start s1 "$PROJECT"
	[ "$status" -eq 0 ] && [ -z "$stderr" ]
	[ -e "$PROJECT/got-term" ]
}
