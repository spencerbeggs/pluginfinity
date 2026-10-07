#!/usr/bin/env bash
# A plugin script outside skills/ that prints the dogfood session env, for the bats helper's
# run_script --session-env test of a non-skill script.
set -euo pipefail
_pf_lib_dir="$(dirname "$0")/../lib/pluginfinity"
. "$_pf_lib_dir/env.sh"
printf 'PFDOG_COLOR=%s\nPFDOG_SHAPE=%s\nPFDOG_LEVEL=%s\n' "$PFDOG_COLOR" "$PFDOG_SHAPE" "$PFDOG_LEVEL"
