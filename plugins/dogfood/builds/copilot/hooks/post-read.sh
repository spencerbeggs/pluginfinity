#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

# The runtime name of Claude's Read tool: Read on Claude Code, view on Copilot.
name=$(hook_tool_name Read)
hook_context "pluginfinity-dogfood: the Read tool is called $name on $(hook_host)"
