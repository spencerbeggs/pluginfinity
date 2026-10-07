#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input
. "$(dirname "$0")/lib/dogfood/probes.sh"
probe_session_start "$(hook_input session_id)"

source=$(hook_input source)
hook_context "pluginfinity-dogfood is loaded on $(hook_host) ($source)"
