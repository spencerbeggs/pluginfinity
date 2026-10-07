#!/usr/bin/env bats
bats_require_minimum_version 1.5.0

setup() {
	BUILDS="$BATS_TEST_DIRNAME/../builds"
	mkdir -p "$BATS_TEST_TMPDIR/project/.git" "$BATS_TEST_TMPDIR/project/node_modules/.bin"
	PROJECT=$(cd "$BATS_TEST_TMPDIR/project" && pwd -P)
	printf '#!/bin/sh\necho "mcp $*"\n' >"$PROJECT/node_modules/.bin/dogfood-mcp"
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
pong from $host, project $PROJECT" ]
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
	[ "$(printf '%s\n' "$output" | jq -r '.result.content[0].text')" = "pong from copilot, project none" ]
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
	[ "$(printf '%s\n' "${lines[0]}" | jq -r '.result.content[0].text')" = "pong from claude, project $PROJECT" ]
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

# lsp_bodies: the JSON bodies of the framed output, one per line (jq reads the concatenated stream).
lsp_bodies() {
	printf '%s' "$output" | tr -d '\r' | sed 's/Content-Length: [0-9]*//g' | jq -c .
}

# frame <json>: one Content-Length framed LSP message.
frame() {
	printf 'Content-Length: %s\r\n\r\n%s' "$(printf '%s' "$1" | wc -c | tr -d ' ')" "$1"
}

@test "the LSP stub answers initialize, shutdown and exit over framed stdio on both hosts" {
	for host in claude copilot; do
		cd "$PROJECT"
		{
			frame '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}'
			frame '{"jsonrpc":"2.0","method":"initialized","params":{}}'
			frame '{"jsonrpc":"2.0","id":2,"method":"shutdown"}'
			frame '{"jsonrpc":"2.0","method":"exit"}'
		} >"$BATS_TEST_TMPDIR/lsp-in"
		run --separate-stderr env -i PATH="$STUB_PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST="$host" \
			PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/$host/lib/pluginfinity" \
			sh "$BUILDS/$host/bin/start-lsp.sh" --stdio <"$BATS_TEST_TMPDIR/lsp-in"
		[ "$status" -eq 0 ]
		# Two framed responses, nothing for the notifications.
		[ "$(printf '%s' "$output" | grep -o 'Content-Length: ' | wc -l | tr -d ' ')" -eq 2 ]
		[ "$(lsp_bodies | jq -c '[.id, .result.capabilities.textDocumentSync, .result.serverInfo.name]' | head -1)" = '[1,1,"dogfood"]' ]
		[ "$(lsp_bodies | jq -c '[.id, .result]' | tail -1)" = '[2,null]' ]
	done
}

@test "the LSP stub exits cleanly when stdin closes and answers an unknown request with -32601" {
	cd "$PROJECT"
	{
		frame '{"jsonrpc":"2.0","id":3,"method":"textDocument/hover"}'
	} >"$BATS_TEST_TMPDIR/lsp-in"
	run --separate-stderr env -i PATH="$STUB_PATH" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST=claude \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/claude/lib/pluginfinity" \
		sh "$BUILDS/claude/bin/start-lsp.sh" --stdio <"$BATS_TEST_TMPDIR/lsp-in"
	[ "$status" -eq 0 ]
	[ "$(lsp_bodies | jq -c '[.id, .error.code]')" = '[3,-32601]' ]
}

@test "the LSP stub logs and exits 1 when jq is missing" {
	mkdir -p "$BATS_TEST_TMPDIR/nojq"
	for t in sh dirname basename date mkdir cat grep rm mktemp tr; do
		ln -s "$(command -v $t)" "$BATS_TEST_TMPDIR/nojq/$t"
	done
	cd "$PROJECT"
	run --separate-stderr env -i PATH="$BATS_TEST_TMPDIR/nojq" HOME="$BATS_TEST_TMPDIR" PLUGINFINITY_HOST=claude \
		PLUGINFINITY_PLUGIN=pluginfinity-dogfood PLUGINFINITY_LIB="$BUILDS/claude/lib/pluginfinity" \
		XDG_STATE_HOME="$BATS_TEST_TMPDIR/state" /bin/sh "$BUILDS/claude/bin/start-lsp.sh" --stdio </dev/null
	[ "$status" -eq 1 ]
	[ -z "$output" ]
	grep -qF "dogfood-lsp: jq is required" "$BATS_TEST_TMPDIR/state/pluginfinity/pluginfinity-dogfood/error.log"
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
