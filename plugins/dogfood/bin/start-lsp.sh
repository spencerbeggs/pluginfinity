#!/bin/sh
set -eu
. "$PLUGINFINITY_LIB/server.sh"
server_exec_bin dogfood-lsp @pluginfinity/dogfood-lsp "$@"
