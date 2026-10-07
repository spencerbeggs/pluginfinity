#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input
hook_debug "probe: env-reach event=$(hook_event) PF_ENV_PROBE=${PF_ENV_PROBE-unset} PF_DIR_PROBE=${PF_DIR_PROBE-unset} session=$(hook_input session_id)"

# A deliberate crash: the read must still happen on both hosts.
file_path=$(hook_input tool_input.file_path)
case "$file_path" in
*pf-dogfood-crash*) false ;;
*) hook_noop ;;
esac
