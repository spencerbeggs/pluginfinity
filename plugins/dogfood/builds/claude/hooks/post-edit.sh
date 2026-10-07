#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

file=$(hook_input tool_input.file_path)
if [ -n "$file" ]; then
	hook_context "pluginfinity-dogfood saw an edit to $file"
else
	hook_noop
fi
