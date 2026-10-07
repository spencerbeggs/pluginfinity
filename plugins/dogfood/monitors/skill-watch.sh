#!/bin/sh
# Starts when the hook-eval skill is invoked (when: on-skill-invoke:hook-eval) and
# notifies once. The live check shows whether the bare skill name matches.
set -eu
_pf_lib_dir="$(dirname "$0")/../lib/pluginfinity"
. "$_pf_lib_dir/monitor.sh"

monitor_debug "started: PWD=$PWD"

watch() {
	monitor_once "$(monitor_name)" "pluginfinity-dogfood $(monitor_name): the hook-eval skill was invoked"
}

monitor_every 300 watch
