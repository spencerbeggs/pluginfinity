#!/bin/sh
# A minimal stdio MCP server (newline-delimited JSON-RPC 2.0) for the dogfood
# fixture: one tool, `ping`. POSIX sh plus jq; stdout carries only responses.
set -eu
. "$PLUGINFINITY_LIB/server.sh"

if ! command -v jq >/dev/null 2>&1; then
	server_log "dogfood-mcp: jq is required"
	exit 1
fi

server_debug "dogfood-mcp: started"

# reply <json>: print a response, never an empty line.
reply() {
	[ -n "$1" ] && printf '%s\n' "$1"
	return 0
}

# respond <jq-filter> [jq args...]: build a response from $line; on failure
# answer -32603 so a request with an id is never left hanging.
respond() {
	_out=$(printf '%s' "$line" | jq -c "$@" 2>/dev/null) || _out=""
	if [ -z "$_out" ]; then
		_out=$(printf '%s' "$line" | jq -c '{jsonrpc: "2.0", id: .id, error: {code: -32603, message: "Internal error"}}' 2>/dev/null) || _out=""
	fi
	reply "$_out"
}

while IFS= read -r line || [ -n "$line" ]; do
	[ -n "$line" ] || continue
	if ! method=$(printf '%s' "$line" | jq -r '.method // empty' 2>/dev/null); then
		server_log "dogfood-mcp: unparseable request ignored"
		continue
	fi
	# A message without an id is a notification: never answered.
	if [ "$(printf '%s' "$line" | jq 'has("id")')" != true ]; then
		server_debug "dogfood-mcp: notification $method"
		continue
	fi
	server_debug "dogfood-mcp: request $method"
	case "$method" in
	initialize)
		respond '{jsonrpc: "2.0", id: .id, result: {protocolVersion: (.params.protocolVersion? // "2025-06-18"), capabilities: {tools: {}}, serverInfo: {name: "dogfood", version: "0.0.0"}}}'
		;;
	ping)
		respond '{jsonrpc: "2.0", id: .id, result: {}}'
		;;
	tools/list)
		respond '{jsonrpc: "2.0", id: .id, result: {tools: [{name: "ping", description: "Reports the host and project the dogfood server runs for", inputSchema: {type: "object", properties: {}}}]}}'
		;;
	tools/call)
		tool=$(printf '%s' "$line" | jq -r '.params.name? // empty' 2>/dev/null) || tool=
		if [ "$tool" = ping ]; then
			project=none
			if dir=$(server_project_dir); then project=$dir; fi
			respond --arg text "pong from $(server_host), project $project" \
				'{jsonrpc: "2.0", id: .id, result: {content: [{type: "text", text: $text}]}}'
		else
			respond --arg msg "Invalid params: unknown or missing tool" \
				'{jsonrpc: "2.0", id: .id, error: {code: -32602, message: $msg}}'
		fi
		;;
	*)
		respond --arg msg "Method not found: $method" \
			'{jsonrpc: "2.0", id: .id, error: {code: -32601, message: $msg}}'
		;;
	esac
done
