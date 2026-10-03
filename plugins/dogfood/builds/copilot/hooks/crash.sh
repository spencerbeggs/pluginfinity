#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

# A deliberate crash: the read must still happen on both hosts.
file_path=$(hook_input tool_input.file_path)
case "$file_path" in
*pf-dogfood-crash*) false ;;
*) hook_noop ;;
esac
