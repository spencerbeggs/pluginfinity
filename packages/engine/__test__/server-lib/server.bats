#!/usr/bin/env bats
load helpers

setup() {
	TMP=$(physical "$BATS_TEST_TMPDIR")
	PROJECT="$TMP/project"
	mkdir -p "$PROJECT/.git" "$PROJECT/sub/dir"
}

stub_npx() { # body
	mkdir -p "$TMP/stub"
	printf '#!/bin/sh\n%s\n' "$1" >"$TMP/stub/npx"
	chmod +x "$TMP/stub/npx"
}

@test "sourcing writes nothing to stdout" {
	make_build claude
	launcher 'true'
	run_launcher
	[ "$status" -eq 0 ]
	[ -z "$output" ]
}

@test "server_host prints the injected host" {
	make_build copilot
	launcher 'server_host'
	run_launcher
	[ "$output" = copilot ]
}

@test "server_plugin_root is the build root" {
	make_build claude
	launcher 'server_plugin_root'
	run_launcher
	[ "$output" = "$BUILD" ]
}

@test "server_project_dir prefers CLAUDE_PROJECT_DIR on claude" {
	make_build claude
	launcher 'server_project_dir'
	run_launcher CLAUDE_PROJECT_DIR=/somewhere
	[ "$output" = /somewhere ]
}

@test "server_project_dir walks up to .git when no variable names it" {
	make_build copilot
	launcher 'server_project_dir'
	cd "$PROJECT/sub/dir"
	run_launcher
	[ "$output" = "$PROJECT" ]
}

@test "server_project_dir ignores CLAUDE_PROJECT_DIR on copilot" {
	make_build copilot
	launcher 'server_project_dir'
	cd "$PROJECT/sub"
	run_launcher CLAUDE_PROJECT_DIR=/elsewhere
	[ "$output" = "$PROJECT" ]
}

@test "server_project_dir falls back to PWD outside a repository" {
	make_build copilot
	launcher 'server_project_dir'
	mkdir -p "$TMP/norepo"
	cd "$TMP/norepo"
	run_launcher
	[ "$output" = "$TMP/norepo" ]
}

@test "server_project_dir reports nothing when cwd is the plugin root on copilot" {
	make_build copilot
	launcher 'server_project_dir'
	cd "$BUILD"
	run_launcher
	[ "$status" -eq 1 ]
	[ -z "$output" ]
}

@test "server_project_dir reports nothing when cwd is inside the plugin root on copilot" {
	make_build copilot
	launcher 'server_project_dir'
	mkdir -p "$BUILD/bin/deeper"
	cd "$BUILD/bin/deeper"
	run_launcher
	[ "$status" -eq 1 ]
	[ -z "$output" ]
}

@test "server_project_dir still honours CLAUDE_PROJECT_DIR on claude with cwd at the plugin root" {
	make_build claude
	launcher 'server_project_dir'
	cd "$BUILD"
	run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$status" -eq 0 ]
	[ "$output" = "$PROJECT" ]
}

@test "server_exec_bin runs the project's installed binary with the args" {
	make_build claude
	mkdir -p "$PROJECT/node_modules/.bin"
	printf '#!/bin/sh\necho "local $*"\n' >"$PROJECT/node_modules/.bin/demo-mcp"
	chmod +x "$PROJECT/node_modules/.bin/demo-mcp"
	launcher 'server_exec_bin demo-mcp @demo/mcp --stdio'
	run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$output" = "local --stdio" ]
	[ -z "$stderr" ]
}

@test "server_exec_bin falls back to npx with an install hint on stderr" {
	make_build claude
	stub_npx 'echo "npx $*"'
	: >"$PROJECT/pnpm-lock.yaml"
	launcher 'server_exec_bin demo-mcp @demo/mcp --stdio'
	PATH="$TMP/stub:$PATH" run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$output" = "npx --yes @demo/mcp --stdio" ]
	[[ "$stderr" == *"pnpm add -D @demo/mcp"* ]]
}

@test "server_exec_bin --install names a separate package in the install hint" {
	make_build claude
	stub_npx 'echo "npx $*"'
	: >"$PROJECT/pnpm-lock.yaml"
	launcher 'server_exec_bin okfit-mcp @okfit/mcp --install @okfit/plugin --stdio'
	PATH="$TMP/stub:$PATH" run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$output" = "npx --yes @okfit/mcp --stdio" ]
	[[ "$stderr" == *"add -D @okfit/plugin"* ]]
	[[ "$stderr" != *"add -D @okfit/mcp"* ]]
}

@test "server_exec_bin passes a later --install through to the binary" {
	make_build claude
	mkdir -p "$PROJECT/node_modules/.bin"
	printf '#!/bin/sh\necho "local $*"\n' >"$PROJECT/node_modules/.bin/b"
	chmod +x "$PROJECT/node_modules/.bin/b"
	launcher 'server_exec_bin b p --stdio --install x'
	run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$output" = "local --stdio --install x" ]
}

@test "server_exec_bin goes straight to npx when there is no project directory" {
	make_build copilot
	stub_npx 'echo "npx $*"'
	launcher 'server_exec_bin demo-mcp @demo/mcp --stdio'
	cd "$BUILD"
	PATH="$TMP/stub:$PATH" run_launcher
	[ "$status" -eq 0 ]
	[ "$output" = "npx --yes @demo/mcp --stdio" ]
	[[ "$stderr" == *"Falling back to"* ]]
	[[ "$stderr" != *"is not installed in"* ]]
	[[ "$stderr" != *"Install it with"* ]]
}

@test "packageManager in package.json wins over a lockfile" {
	make_build claude
	stub_npx ':'
	: >"$PROJECT/pnpm-lock.yaml"
	printf '{"packageManager": "yarn@4.0.0"}\n' >"$PROJECT/package.json"
	launcher 'server_exec_bin demo-mcp @demo/mcp'
	PATH="$TMP/stub:$PATH" run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[[ "$stderr" == *"yarn add -D @demo/mcp"* ]]
}

@test "a launcher run with PLUGINFINITY_LIB unset fails with a clear message" {
	make_build claude
	launcher 'true'
	run --separate-stderr env -i PATH="$PATH" "${SH_UNDER_TEST:-sh}" "$BUILD/bin/launch.sh"
	[ "$status" -ne 0 ]
	[[ "$stderr" == *"PLUGINFINITY_LIB"* ]]
}

@test "server_log appends to the plugin's server log" {
	make_build claude
	launcher 'server_log "boom"'
	run_launcher
	grep -q "boom" "$TMP/state/pluginfinity/fixture/error.log"
}
