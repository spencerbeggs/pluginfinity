#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input
hook_debug "probe: env-reach event=$(hook_event) PF_ENV_PROBE=${PF_ENV_PROBE-unset} PF_DIR_PROBE=${PF_DIR_PROBE-unset} session=$(hook_input session_id)"

file=$(hook_input tool_input.file_path)
if [ -n "$file" ]; then
	hook_context "pluginfinity-dogfood saw an edit to $file"
else
	hook_noop
fi
