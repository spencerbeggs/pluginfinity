#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

cmd=$(hook_input tool_input.command)
case "$cmd" in
*pf-dogfood-deny*) hook_deny "pluginfinity-dogfood denies commands holding pf-dogfood-deny" ;;
*) hook_noop ;;
esac
