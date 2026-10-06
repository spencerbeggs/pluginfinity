#!/usr/bin/env bats
bats_require_minimum_version 1.5.0

setup() {
	BUILDS="$BATS_TEST_DIRNAME/../builds"
	PROJECT="$BATS_TEST_TMPDIR/project"
	mkdir -p "$PROJECT/.git" "$PROJECT/node_modules/.bin"
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

@test "the MCP launcher runs the project's binary on both hosts" {
	for host in claude copilot; do
		run_built "$host" start-mcp.sh
		[ "$status" -eq 0 ]
		[ "$output" = "mcp " ]
	done
}

@test "the LSP launcher passes --stdio through" {
	run_built copilot start-lsp.sh --stdio
	[ "$output" = "lsp --stdio" ]
}

@test "the built configs point at the shipped launchers" {
	grep -q '${CLAUDE_PLUGIN_ROOT}/bin/start-mcp.sh' "$BUILDS/claude/.mcp.json"
	grep -q '"fileExtensions"' "$BUILDS/copilot/com.github.copilot/lsp.json"
	[ -f "$BUILDS/claude/share/greeting.txt" ]
	grep -qF '"PLUGINFINITY_LIB": "${CLAUDE_PLUGIN_ROOT}/lib/pluginfinity"' "$BUILDS/claude/.mcp.json"
	grep -qF '"PLUGINFINITY_LIB": "${PLUGIN_ROOT}/lib/pluginfinity"' "$BUILDS/copilot/com.github.copilot/lsp.json"
}
