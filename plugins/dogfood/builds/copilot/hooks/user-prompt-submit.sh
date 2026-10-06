#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

prompt=$(hook_input prompt)
case "$prompt" in
*pf-dogfood-system*) hook_system_message "pluginfinity-dogfood saw the marker" ;;
*) hook_noop ;;
esac
