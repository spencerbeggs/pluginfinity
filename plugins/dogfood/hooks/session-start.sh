#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

source=$(hook_input source)
hook_context "pluginfinity-dogfood is loaded on $(hook_host) ($source)"
