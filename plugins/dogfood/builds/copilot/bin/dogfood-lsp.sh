#!/bin/sh
# A minimal LSP server for the dogfood fixture: Content-Length framed JSON-RPC on
# stdio. Answers initialize and shutdown, ignores notifications, exits on `exit`.
# POSIX sh plus jq; stdout carries only framed messages.
set -eu
. "$PLUGINFINITY_LIB/server.sh"

# frame <json>: write one Content-Length framed message.
frame() {
	_len=$(printf '%s' "$1" | wc -c | tr -d ' ')
	printf 'Content-Length: %s\r\n\r\n%s' "$_len" "$1"
}

# respond <jq args...> <filter>: build a message from the current request and frame it.
respond() {
	_out=$(printf '%s' "$msg" | jq -c "$@") || return 0
	frame "$_out"
}

while :; do
	len=
	# Headers: lines up to the blank one; only Content-Length matters.
	while IFS= read -r header; do
		header=${header%"$(printf '\r')"}
		[ -n "$header" ] || break
		case "$header" in
		[Cc]ontent-[Ll]ength:*) len=$(printf '%s' "${header#*:}" | tr -d ' ') ;;
		esac
	done || exit 0
	[ -n "$len" ] || exit 0
	msg=$(dd bs=1 count="$len" 2>/dev/null) || exit 0
	if ! method=$(printf '%s' "$msg" | jq -r '.method // empty' 2>/dev/null); then
		server_debug "dogfood-lsp: unparseable message"
		continue
	fi
	server_debug "dogfood-lsp: $method"
	case "$method" in
	initialize)
		respond '{jsonrpc: "2.0", id: .id, result: {capabilities: {textDocumentSync: 1}, serverInfo: {name: "dogfood", version: "0.0.0"}}}'
		;;
	shutdown)
		respond '{jsonrpc: "2.0", id: .id, result: null}'
		;;
	exit)
		exit 0
		;;
	*)
		# A request (has an id) we do not implement gets MethodNotFound; notifications are ignored.
		if [ "$(printf '%s' "$msg" | jq 'has("id") and has("method")')" = true ]; then
			respond '{jsonrpc: "2.0", id: .id, error: {code: -32601, message: "Method not found"}}'
		fi
		;;
	esac
done
