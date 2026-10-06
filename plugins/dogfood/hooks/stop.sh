#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

stop_hook_active=$(hook_input stop_hook_active)
if [ "$stop_hook_active" != true ] && [ -e "$(hook_project_dir)/.pf-dogfood-block" ]; then
	hook_block "pluginfinity-dogfood: delete .pf-dogfood-block, then stop"
else
	hook_noop
fi
