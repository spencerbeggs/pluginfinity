#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input
hook_debug "probe: env-reach event=$(hook_event) PF_ENV_PROBE=${PF_ENV_PROBE-unset} PF_DIR_PROBE=${PF_DIR_PROBE-unset} session=$(hook_input session_id)"

cmd=$(hook_input tool_input.command)
case "$cmd" in
*pf-dogfood-deny*) hook_deny "pluginfinity-dogfood denies commands holding pf-dogfood-deny" ;;
*pf-dogfood-allow*) hook_allow "pluginfinity-dogfood approves commands holding pf-dogfood-allow" ;;
# The entry is failClosed: a crash here must deny, not let the call through.
*pf-dogfood-closed-crash*) false ;;
*) hook_noop ;;
esac
