#!/bin/sh
set -eu
. "$PLUGINFINITY_LIB/server.sh"
exec sh "$(dirname "$0")/dogfood-lsp.sh" "$@"
