#!/usr/bin/env bats
bats_require_minimum_version 1.5.0

setup() {
	BUILDS="$BATS_TEST_DIRNAME/../builds"
	mkdir -p "$BATS_TEST_TMPDIR/project/.git" "$BATS_TEST_TMPDIR/project/node_modules/.bin"
	PROJECT=$(cd "$BATS_TEST_TMPDIR/project" && pwd -P)
	printf '#!/bin/sh\necho "mcp $*"\n' >"$PROJECT/node_modules/.bin/dogfood-mcp"
	printf '#!/bin/sh\necho "lsp $*"\n' >"$PROJECT/node_modules/.bin/dogfood-lsp"
	chmod +x "$PROJECT/node_modules/.bin/"*
	# No test may reach a real package manager: every runner is a stub that fails loudly.
	mkdir -p "$BATS_TEST_TMPDIR/stub"
	for r in pnpm yarn bun bunx npx; do
		printf '#!/bin/sh\necho "unstubbed runner %s $*" >&2\nexit 97\n' "$r" >"$BATS_TEST_TMPDIR/stub/$r"
		chmod +x "$BATS_TEST_TMPDIR/stub/$r"
	done
	STUB_PATH="$BATS_TEST_TMPDIR/stub:$PATH"
}

run_built() { # host launcher [args...]
	local host=$1 launcher=$2
	shift 2
	cd "$PROJECT"
	run --separate-stderr env -i PATH="$STUB_PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST="$host" \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/$host/lib/pluginfinity" \
		sh "$BUILDS/$host/bin/$launcher" "$@"
}

mcp_session() { # host: pipe a full session into the built MCP launcher
	local host=$1
	cd "$PROJECT"
	run --separate-stderr env -i PATH="$STUB_PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST="$host" \
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
pong from $host, project $PROJECT, pwd=$PROJECT" ]
		[ "$(printf '%s\n' "${lines[3]}" | jq -c '[.id, .result]')" = '[4,{}]' ]
		[ "$(printf '%s\n' "${lines[4]}" | jq -c '[.id, .error.code]')" = '[5,-32601]' ]
	done
}

@test "the MCP server reports no project on copilot with the cwd at the plugin root" {
	cd "$BUILDS/copilot"
	run --separate-stderr env -i PATH="$STUB_PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST=copilot \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/copilot/lib/pluginfinity" \
		sh "$BUILDS/copilot/bin/start-mcp.sh" <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ping"}}
JSON
	[ "$(printf '%s\n' "$output" | jq -r '.result.content[0].text')" = "pong from copilot, project none, pwd=$(cd "$BUILDS/copilot" && pwd -P)" ]
}

run_mcp_input() { # input (claude host)
	cd "$PROJECT"
	run --separate-stderr env -i PATH="$STUB_PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST=claude \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/claude/lib/pluginfinity" \
		CLAUDE_PROJECT_DIR="$PROJECT" sh "$BUILDS/claude/bin/start-mcp.sh" <<<"$1"
}

@test "the MCP server survives quotes and backslashes in params" {
	run_mcp_input '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ping","arguments":{"x":"a\"b\\c"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
	[ "$status" -eq 0 ]
	[ "${#lines[@]}" -eq 2 ]
	[ "$(printf '%s\n' "${lines[0]}" | jq -r '.result.content[0].text')" = "pong from claude, project $PROJECT, pwd=$PROJECT" ]
	[ "$(printf '%s\n' "${lines[1]}" | jq -c '[.id, .result.tools[0].name]')" = '[2,"ping"]' ]
}

@test "the MCP server answers -32602 for non-object params and keeps going" {
	run_mcp_input '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":"oops"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
	[ "$status" -eq 0 ]
	[ "${#lines[@]}" -eq 2 ]
	[ "$(printf '%s\n' "${lines[0]}" | jq -c '[.id, .error.code]')" = '[1,-32602]' ]
	[ "$(printf '%s\n' "${lines[1]}" | jq -c '.id')" = 2 ]
}

@test "the MCP server answers a final request with no trailing newline" {
	cd "$PROJECT"
	run --separate-stderr env -i PATH="$STUB_PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST=claude \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/claude/lib/pluginfinity" \
		sh -c "printf '%s' '{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"ping\"}' | sh '$BUILDS/claude/bin/start-mcp.sh'"
	[ "$(printf '%s\n' "$output" | jq -c '.id')" = 7 ]
}

@test "the MCP server requests roots after initialized and logs the response" {
	for host in claude copilot; do
		cd "$PROJECT"
		run --separate-stderr env -i PATH="$STUB_PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST="$host" \
			PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/$host/lib/pluginfinity" \
			XDG_STATE_HOME="$BATS_TEST_TMPDIR/state-$host" PLUGINFINITY_DEBUG=1 \
			sh "$BUILDS/$host/bin/start-mcp.sh" <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{"roots":{"listChanged":true}},"clientInfo":{"name":"rc","version":"9"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":"pf-roots","result":{"roots":[{"uri":"file:///work/proj","name":"proj"}]}}
{"jsonrpc":"2.0","id":2,"method":"ping"}
JSON
		[ "$status" -eq 0 ]
		# initialize answer, the server's own roots/list request, then the ping answer: nothing for the roots response.
		[ "${#lines[@]}" -eq 3 ]
		[ "$(printf '%s\n' "${lines[0]}" | jq -c '.id')" = 1 ]
		[ "${lines[1]}" = '{"jsonrpc":"2.0","id":"pf-roots","method":"roots/list"}' ]
		[ "$(printf '%s\n' "${lines[2]}" | jq -c '[.id, .result]')" = '[2,{}]' ]
		log="$BATS_TEST_TMPDIR/state-$host/pluginfinity/pluginfinity-dogfood/debug.log"
		grep -qF 'probe: mcp-init client=rc/9 caps={"roots":{"listChanged":true}} pwd='"$PROJECT"' oldpwd=' "$log"
		grep -qF 'probe: mcp-roots {"result":{"roots":[{"uri":"file:///work/proj","name":"proj"}]}}' "$log"
	done
}

@test "the MCP server asks for no roots when the client advertises none" {
	mcp_session claude
	[ "${#lines[@]}" -eq 5 ]
	run ! grep -q pf-roots <<<"$output"
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
