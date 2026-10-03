#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

case "$(hook_input tool_input.command)" in
*pf-dogfood-deny*) hook_deny "pluginfinity-dogfood denies commands holding pf-dogfood-deny" ;;
*) hook_noop ;;
esac
