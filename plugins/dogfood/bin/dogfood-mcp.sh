#!/bin/sh
# A minimal stdio MCP server (newline-delimited JSON-RPC 2.0) for the dogfood
# fixture: one tool, `ping`. POSIX sh plus jq; stdout carries only responses.
set -eu
. "$PLUGINFINITY_LIB/server.sh"

server_debug "dogfood-mcp: started"

reply() { # json
	printf '%s\n' "$1"
}

while IFS= read -r line; do
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
		reply "$(printf '%s' "$line" | jq -c '{jsonrpc: "2.0", id: .id, result: {protocolVersion: (.params.protocolVersion // "2025-06-18"), capabilities: {tools: {}}, serverInfo: {name: "dogfood", version: "0.0.0"}}}')"
		;;
	ping)
		reply "$(printf '%s' "$line" | jq -c '{jsonrpc: "2.0", id: .id, result: {}}')"
		;;
	tools/list)
		reply "$(printf '%s' "$line" | jq -c '{jsonrpc: "2.0", id: .id, result: {tools: [{name: "ping", description: "Reports the host and project the dogfood server runs for", inputSchema: {type: "object", properties: {}}}]}}')"
		;;
	tools/call)
		tool=$(printf '%s' "$line" | jq -r '.params.name // empty')
		if [ "$tool" = ping ]; then
			project=none
			if dir=$(server_project_dir); then project=$dir; fi
			reply "$(printf '%s' "$line" | jq -c --arg text "pong from $(server_host), project $project" \
				'{jsonrpc: "2.0", id: .id, result: {content: [{type: "text", text: $text}]}}')"
		else
			reply "$(printf '%s' "$line" | jq -c --arg msg "Unknown tool: $tool" \
				'{jsonrpc: "2.0", id: .id, error: {code: -32602, message: $msg}}')"
		fi
		;;
	*)
		reply "$(printf '%s' "$line" | jq -c --arg msg "Method not found: $method" \
			'{jsonrpc: "2.0", id: .id, error: {code: -32601, message: $msg}}')"
		;;
	esac
done
