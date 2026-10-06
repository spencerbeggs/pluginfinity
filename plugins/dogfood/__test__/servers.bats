#!/usr/bin/env bats
bats_require_minimum_version 1.5.0

setup() {
	BUILDS="$BATS_TEST_DIRNAME/../builds"
	mkdir -p "$BATS_TEST_TMPDIR/project/.git" "$BATS_TEST_TMPDIR/project/node_modules/.bin"
	PROJECT=$(cd "$BATS_TEST_TMPDIR/project" && pwd -P)
	printf '#!/bin/sh\necho "mcp $*"\n' >"$PROJECT/node_modules/.bin/dogfood-mcp"
	printf '#!/bin/sh\necho "lsp $*"\n' >"$PROJECT/node_modules/.bin/dogfood-lsp"
	chmod +x "$PROJECT/node_modules/.bin/"*
}

run_built() { # host launcher [args...]
	local host=$1 launcher=$2
	shift 2
	cd "$PROJECT"
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST="$host" \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/$host/lib/pluginfinity" \
		sh "$BUILDS/$host/bin/$launcher" "$@"
}

mcp_session() { # host: pipe a full session into the built MCP launcher
	local host=$1
	cd "$PROJECT"
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST="$host" \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/$host/lib/pluginfinity" \
		CLAUDE_PROJECT_DIR="$PROJECT" sh "$BUILDS/$host/bin/start-mcp.sh" <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ping","arguments":{}}}
{"jsonrpc":"2.0","id":4,"method":"ping"}
{"jsonrpc":"2.0","id":5,"method":"nope/nothing"}
JSON
}

@test "the MCP server answers a full session on both hosts" {
	for host in claude copilot; do
		mcp_session "$host"
		[ "$status" -eq 0 ]
		# One response per request; the notification gets none.
		[ "${#lines[@]}" -eq 5 ]
		[ "$(printf '%s\n' "${lines[0]}" | jq -c '[.id, .result.protocolVersion, .result.serverInfo.name, (.result.capabilities | keys)]')" = '[1,"2025-03-26","dogfood",["tools"]]' ]
		[ "$(printf '%s\n' "${lines[1]}" | jq -c '[.id, [.result.tools[].name]]')" = '[2,["ping"]]' ]
		[ "$(printf '%s\n' "${lines[2]}" | jq -r '.id, .result.content[0].text')" = "3
pong from $host, project $PROJECT" ]
		[ "$(printf '%s\n' "${lines[3]}" | jq -c '[.id, .result]')" = '[4,{}]' ]
		[ "$(printf '%s\n' "${lines[4]}" | jq -c '[.id, .error.code]')" = '[5,-32601]' ]
	done
}

@test "the MCP server reports no project on copilot with the cwd at the plugin root" {
	cd "$BUILDS/copilot"
	run --separate-stderr env -i PATH="$PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST=copilot \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/copilot/lib/pluginfinity" \
		sh "$BUILDS/copilot/bin/start-mcp.sh" <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ping"}}
JSON
	[ "$(printf '%s\n' "$output" | jq -r '.result.content[0].text')" = "pong from copilot, project none" ]
}

@test "the LSP launcher passes --stdio through" {
	run_built copilot start-lsp.sh --stdio
	[ "$output" = "lsp --stdio" ]
}

@test "the built configs point at the shipped launchers" {
	manifest="$BUILDS/claude/.claude-plugin/plugin.json"
	grep -q '${CLAUDE_PLUGIN_ROOT}/bin/start-mcp.sh' "$manifest"
	grep -q '"fileExtensions"' "$BUILDS/copilot/com.github.copilot/lsp.json"
	[ -f "$BUILDS/claude/share/greeting.txt" ]
	grep -qF '"PLUGINFINITY_LIB": "${CLAUDE_PLUGIN_ROOT}/lib/pluginfinity"' "$manifest"
	grep -qF '"PLUGINFINITY_LIB": "${PLUGIN_ROOT}/lib/pluginfinity"' "$BUILDS/copilot/com.github.copilot/lsp.json"
}

@test "claude carries its servers inline in plugin.json, with no root server file" {
	manifest="$BUILDS/claude/.claude-plugin/plugin.json"
	grep -q '"mcpServers": {' "$manifest"
	grep -q '"lspServers": {' "$manifest"
	[ ! -e "$BUILDS/claude/.mcp.json" ]
	[ ! -e "$BUILDS/claude/.lsp.json" ]
	run ! grep -q '"mcpServers"' "$BUILDS/copilot/plugin.json"
	[ -f "$BUILDS/copilot/mcp.json" ]
}
