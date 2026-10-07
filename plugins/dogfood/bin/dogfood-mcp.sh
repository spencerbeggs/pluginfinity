#!/bin/sh
# A minimal stdio MCP server (newline-delimited JSON-RPC 2.0) for the dogfood
# fixture: one tool, `ping`. POSIX sh plus jq; stdout carries only JSON-RPC
# messages. Round-3 probes (debug.log lines starting `probe:`) record what the
# host tells an MCP server about the project; see probe_init and the roots request.
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

roots_ok=no

# probe_init: log the client, its capabilities, the cwd and env var NAMES (never values).
probe_init() {
	_client=$(printf '%s' "$line" | jq -r '"\(.params.clientInfo.name? // "unknown")/\(.params.clientInfo.version? // "unknown")"' 2>/dev/null) || _client=unknown
	_caps=$(printf '%s' "$line" | jq -c '.params.capabilities? // {}' 2>/dev/null) || _caps=unknown
	_names=$(env | grep -E '^[A-Za-z_][A-Za-z0-9_]*=' | cut -d= -f1 | grep -E 'PROJECT|CWD|ROOT|WORKSPACE|COPILOT_|CLAUDE_' | tr '\n' ' ') || true
	server_debug "probe: mcp-init client=$_client caps=$_caps pwd=$PWD oldpwd=${OLDPWD:-unset}"
	server_debug "probe: mcp-env names=${_names:-none}"
	if [ "$(printf '%s' "$line" | jq '.params.capabilities? | type == "object" and has("roots")' 2>/dev/null)" = true ]; then
		roots_ok=yes
	fi
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
		if [ "$method" = notifications/initialized ] && [ "$roots_ok" = yes ]; then
			printf '%s\n' '{"jsonrpc":"2.0","id":"pf-roots","method":"roots/list"}'
			server_debug "probe: mcp-roots requested"
		fi
		continue
	fi
	# An id and no method is a response to a request this server made: log the
	# roots answer, never reply to it.
	if [ -z "$method" ]; then
		if [ "$(printf '%s' "$line" | jq -r '.id | tostring' 2>/dev/null)" = pf-roots ]; then
			server_debug "probe: mcp-roots $(printf '%s' "$line" | jq -c '{result: .result, error: .error} | with_entries(select(.value != null))' 2>/dev/null)"
		fi
		continue
	fi
	server_debug "dogfood-mcp: request $method"
	case "$method" in
	initialize)
		probe_init
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
			respond --arg text "pong from $(server_host), project $project, pwd=$PWD" \
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
