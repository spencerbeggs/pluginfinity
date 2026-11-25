#!/usr/bin/env bash
#
# trigger-harness.sh: run should-trigger and should-not-trigger queries against
# a client several times each and print how often the skill fired.
#
# Two functions are client-specific: run_client, which runs one query and
# writes a transcript, and check_triggered, which reads one. As shipped both
# are for Claude Code. Everything else is client-independent.
set -euo pipefail

usage() {
	cat <<'USAGE'
Usage: trigger-harness.sh --skill NAME --positives FILE --negatives FILE
                          --transcript-dir DIR [--runs N] [--plugin-dir DIR]
                          [--max-turns N] [--dry-run]

Runs every query in --positives and --negatives, --runs times each, in a fresh
`claude -p` process, and prints one JSON line per query on stdout:
  {"query":"...","expected":true,"triggered":2,"runs":3,"rate":0.67}
Progress goes to stderr.

Each line of --positives and --negatives is one query. Blank lines and lines
starting with # are skipped.

Options:
  --skill NAME          The skill under test, without the plugin prefix.
  --positives FILE      Queries that should trigger it, one per line.
  --negatives FILE      Queries that should not, one per line.
  --transcript-dir DIR  Where each run's transcript is written. Kept afterwards.
  --runs N              Runs per query. Default 3.
  --plugin-dir DIR      A built plugin to load for the runs, such as
                        builds/claude. Without it the runs see whatever
                        plugins the user has installed.
  --max-turns N         Turns each run may take. Default 3: enough to see the
                        skill load, without paying for the whole task.
  --dry-run             Print the plan and run nothing.
  -h, --help            Show this message.

Requires jq, and claude on PATH unless --dry-run. Every run is a real model
call and is billed.

Exit codes:
  0  Finished. Rates are printed whatever they are; applying a pass threshold
     is the caller's job.
  2  A usage error, or a required tool is missing.
  3  A run of the client failed. The transcript named on stderr says why.

Before trusting a rate, run one query you know should trigger the skill and
confirm it reports a rate above 0. All zeroes can mean the skill never fires,
or that check_triggered does not match this client's transcript.
USAGE
}

die() {
	printf 'Error: %s\n' "$1" >&2
	exit 2
}

# Reject a missing value, or one that is another of this script's flags.
require_value() {
	[ "$2" -ge 2 ] || die "$1 requires a value. Run with --help for usage."
	case "$3" in
	--skill | --positives | --negatives | --runs | --transcript-dir | --plugin-dir | --max-turns | --dry-run | -h | --help)
		die "$1 requires a value but got the flag '$3'. Run with --help for usage."
		;;
	esac
	[ -n "$3" ] || die "$1 was given an empty value. Run with --help for usage."
}

# Client-specific: run one query in a fresh process, writing its transcript.
# $1 = query, $2 = transcript path. Returns the client's exit status.
run_client() {
	local query="$1" transcript="$2"
	local -a cmd=(claude -p "$query" --output-format stream-json --verbose --max-turns "$MAX_TURNS")
	[ -z "$PLUGIN_DIR" ] || cmd+=(--plugin-dir "$PLUGIN_DIR")
	"${cmd[@]}" >"$transcript" 2>"$transcript.err" </dev/null
}

# Client-specific: did the skill fire in this transcript?
# $1 = skill name, $2 = transcript path. Returns 0 when it did.
# A Claude Code stream-json transcript holds one JSON object per line; a skill
# loads through a Skill tool call whose input names it, as `<skill>` or
# `<plugin>:<skill>`.
check_triggered() {
	local skill="$1" transcript="$2"
	[ -s "$transcript" ] || return 1
	jq -e -s --arg skill "$skill" '
		[.[] | select(type == "object" and .type == "assistant") | .message.content[]?
		 | select(.type == "tool_use" and .name == "Skill")
		 | (.input.skill // "") | select(. == $skill or endswith(":" + $skill))]
		| length > 0' "$transcript" >/dev/null 2>&1
}

SKILL="" POSITIVES="" NEGATIVES="" RUNS=3 TRANSCRIPT_DIR="" PLUGIN_DIR="" MAX_TURNS=3 DRYRUN=0
while [ $# -gt 0 ]; do
	case "$1" in
	--skill) require_value --skill "$#" "${2-}"; SKILL="$2"; shift 2 ;;
	--positives) require_value --positives "$#" "${2-}"; POSITIVES="$2"; shift 2 ;;
	--negatives) require_value --negatives "$#" "${2-}"; NEGATIVES="$2"; shift 2 ;;
	--runs) require_value --runs "$#" "${2-}"; RUNS="$2"; shift 2 ;;
	--transcript-dir) require_value --transcript-dir "$#" "${2-}"; TRANSCRIPT_DIR="$2"; shift 2 ;;
	--plugin-dir) require_value --plugin-dir "$#" "${2-}"; PLUGIN_DIR="$2"; shift 2 ;;
	--max-turns) require_value --max-turns "$#" "${2-}"; MAX_TURNS="$2"; shift 2 ;;
	--dry-run) DRYRUN=1; shift ;;
	-h | --help) usage; exit 0 ;;
	*) die "Unknown argument '$1'. Run with --help for usage." ;;
	esac
done

positive_int() {
	case "$2" in '' | *[!0-9]*) die "$1 must be a positive whole number. Received: \"$2\"" ;; esac
	[ "$2" -gt 0 ] || die "$1 must be a positive whole number. Received: \"$2\""
}

command -v jq >/dev/null 2>&1 || die "jq is required but was not found on PATH."
[ -n "$SKILL" ] || die "--skill is required. Run with --help for usage."
case "$SKILL" in *:*) die "--skill takes the skill's own name, without the plugin prefix. Received: \"$SKILL\"" ;; esac
[ -n "$POSITIVES" ] && [ -f "$POSITIVES" ] || die "--positives must name an existing file."
[ -n "$NEGATIVES" ] && [ -f "$NEGATIVES" ] || die "--negatives must name an existing file."
positive_int --runs "$RUNS"
positive_int --max-turns "$MAX_TURNS"
[ -n "$TRANSCRIPT_DIR" ] || die "--transcript-dir is required. Run with --help for usage."
[ -z "$PLUGIN_DIR" ] || [ -d "$PLUGIN_DIR" ] || die "--plugin-dir must name an existing directory. Received: \"$PLUGIN_DIR\""
if [ "$DRYRUN" -eq 0 ]; then
	command -v claude >/dev/null 2>&1 || die "claude is required but was not found on PATH. Use --dry-run to see the plan."
fi
mkdir -p "$TRANSCRIPT_DIR"

# $1 = file of queries, $2 = "true" or "false": whether they should trigger.
run_set() {
	local file="$1" expected="$2" query triggered i transcript digest
	while IFS= read -r query || [ -n "$query" ]; do
		case "$query" in '' | '#'*) continue ;; esac
		if [ "$DRYRUN" -eq 1 ]; then
			jq -nc --arg query "$query" --argjson expected "$expected" --argjson runs "$RUNS" \
				'{query: $query, expected: $expected, runs: $runs, dry_run: true}'
			continue
		fi
		triggered=0
		digest="$(printf '%s' "$query" | cksum | cut -d' ' -f1)"
		for i in $(seq 1 "$RUNS"); do
			transcript="${TRANSCRIPT_DIR}/${digest}-${i}.jsonl"
			printf 'run %s/%s: %s\n' "$i" "$RUNS" "$query" >&2
			if ! run_client "$query" "$transcript" && [ ! -s "$transcript" ]; then
				printf 'Error: the client failed and wrote no transcript. See %s.err\n' "$transcript" >&2
				exit 3
			fi
			if check_triggered "$SKILL" "$transcript"; then
				triggered=$((triggered + 1))
			fi
		done
		jq -nc --arg query "$query" --argjson expected "$expected" \
			--argjson triggered "$triggered" --argjson runs "$RUNS" \
			'{query: $query, expected: $expected, triggered: $triggered, runs: $runs,
			  rate: (($triggered / $runs * 100 | round) / 100)}'
	done <"$file"
}

run_set "$POSITIVES" true
run_set "$NEGATIVES" false
