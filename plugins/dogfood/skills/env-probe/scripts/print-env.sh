#!/usr/bin/env bash
set -euo pipefail
_pf_lib_dir="$(cd "$(dirname "$0")/../../../lib/pluginfinity" && pwd)"
# shellcheck source=/dev/null
. "$_pf_lib_dir/env.sh"
printf 'PFDOG_COLOR=%s\nPFDOG_SHAPE=%s\nPFDOG_LEVEL=%s\n' "$PFDOG_COLOR" "$PFDOG_SHAPE" "$PFDOG_LEVEL"
