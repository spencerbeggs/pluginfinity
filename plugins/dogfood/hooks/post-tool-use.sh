#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

case "$(hook_input tool_input.command)" in
*pf-dogfood-context*) hook_context "pluginfinity-dogfood saw pf-dogfood-context" ;;
*) hook_noop ;;
esac
