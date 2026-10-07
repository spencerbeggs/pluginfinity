#!/bin/sh
# Always-on monitor: tells the model once per session that it is alive, and records
# where Claude Code started it, for the live check (okf/measurements).
set -eu
_pf_lib_dir="$(dirname "$0")/../lib/pluginfinity"
. "$_pf_lib_dir/monitor.sh"

monitor_debug "env: PWD=$PWD CLAUDE_PROJECT_DIR=${CLAUDE_PROJECT_DIR:-<unset>} project_dir=$(monitor_project_dir)"
monitor_debug "env: $(env | grep '^PLUGINFINITY_' | sort | tr '\n' ' ')"

beat() {
	monitor_once heartbeat "pluginfinity-dogfood heartbeat: $(monitor_name) is alive"
}

monitor_every 60 beat
