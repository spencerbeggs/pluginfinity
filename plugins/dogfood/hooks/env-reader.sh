#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input
# The library has applied the session env before this line, so a declared name is just a variable.
pattern=$(hook_input tool_input.pattern)
case "$pattern" in
*pf-dogfood-env*) hook_context "pluginfinity-dogfood env: PFDOG_COLOR=$PFDOG_COLOR" ;;
*) hook_noop ;;
esac
