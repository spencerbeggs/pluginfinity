#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

hook_context "pluginfinity-dogfood is loaded on $(hook_host) ($(hook_input source))"
