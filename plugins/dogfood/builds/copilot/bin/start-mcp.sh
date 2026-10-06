#!/bin/sh
set -eu
. "$PLUGINFINITY_LIB/server.sh"
exec sh "$(server_plugin_root)/bin/dogfood-mcp.sh"
