#!/usr/bin/env bats
load helpers

setup() {
	TMP=$(physical "$BATS_TEST_TMPDIR")
	PROJECT="$TMP/project"
	mkdir -p "$PROJECT/.git" "$PROJECT/sub/dir"
	# Every runner is a stub that fails loudly, so no test can reach a real package manager.
	for r in pnpm yarn bun bunx npx; do
		stub_cmd "$r" 'echo "unstubbed runner $0 $*" >&2; exit 97'
	done
}

stub_cmd() { # name body
	mkdir -p "$TMP/stub"
	printf '#!/bin/sh\n%s\n' "$2" >"$TMP/stub/$1"
	chmod +x "$TMP/stub/$1"
}
stub_npx() { stub_cmd npx "$1"; }

# A PATH holding only the tools the library and bats need, so jq (or pnpm) is absent.
bare_path() {
	mkdir -p "$TMP/bare"
	for t in env sh bash dirname grep sed cat cut mkdir mktemp date tr head uname rm basename wc sort ls; do
		ln -sf "$(command -v "$t")" "$TMP/bare/$t"
	done
}

run_fallback() { # [VAR=value...]
	launcher 'server_exec_bin demo-mcp @demo/mcp --stdio'
	PATH="$TMP/stub:$PATH" run_launcher CLAUDE_PROJECT_DIR="$PROJECT" "$@"
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
	launcher 'server_exec_bin demo-mcp @demo/mcp --stdio'
	PATH="$TMP/stub:$PATH" run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$output" = "npx --yes @demo/mcp --stdio" ]
	[[ "$stderr" == *"npm install --save-dev @demo/mcp"* ]]
	[[ "$stderr" == *'Falling back to "npx --yes @demo/mcp"'* ]]
}

@test "server_exec_bin --install names a separate package in the install hint" {
	make_build claude
	stub_cmd pnpm 'echo "pnpm $*"'
	: >"$PROJECT/pnpm-lock.yaml"
	launcher 'server_exec_bin okfit-mcp @okfit/mcp --install @okfit/plugin --stdio'
	PATH="$TMP/stub:$PATH" run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$output" = "pnpm dlx @okfit/mcp --stdio" ]
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
	stub_cmd yarn ':'
	: >"$PROJECT/pnpm-lock.yaml"
	printf '{"packageManager": "yarn@4.0.0"}\n' >"$PROJECT/package.json"
	launcher 'server_exec_bin demo-mcp @demo/mcp'
	PATH="$TMP/stub:$PATH" run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[[ "$stderr" == *"yarn add -D @demo/mcp"* ]]
}

@test "devEngines.packageManager as an object selects pnpm dlx with no lockfile" {
	make_build claude
	stub_cmd pnpm 'echo "pnpm $*"'
	printf '{"devEngines": {"packageManager": {"name": "pnpm", "version": "12.10.0"}}}\n' >"$PROJECT/package.json"
	run_fallback
	[ "$output" = "pnpm dlx @demo/mcp --stdio" ]
	[[ "$stderr" == *'Falling back to "pnpm dlx @demo/mcp"'* ]]
	[[ "$stderr" == *"pnpm add -D @demo/mcp"* ]]
}

@test "devEngines.packageManager as an array uses its first entry" {
	make_build claude
	stub_cmd yarn 'echo "yarn $*"'
	printf '{"devEngines": {"packageManager": [{"name": "yarn"}, {"name": "npm"}]}}\n' >"$PROJECT/package.json"
	run_fallback
	[ "$output" = "yarn dlx @demo/mcp --stdio" ]
}

@test "packageManager bun selects bunx" {
	make_build claude
	stub_cmd bunx 'echo "bunx $*"'
	printf '{"packageManager": "bun@1.2.0"}\n' >"$PROJECT/package.json"
	run_fallback
	[ "$output" = "bunx @demo/mcp --stdio" ]
	[[ "$stderr" == *'Falling back to "bunx @demo/mcp"'* ]]
}

@test "devEngines wins over packageManager and lockfiles" {
	make_build claude
	stub_cmd pnpm 'echo "pnpm $*"'
	: >"$PROJECT/yarn.lock"
	printf '{"packageManager": "yarn@4.0.0", "devEngines": {"packageManager": {"name": "pnpm"}}}\n' >"$PROJECT/package.json"
	run_fallback
	[ "$output" = "pnpm dlx @demo/mcp --stdio" ]
}

@test "a lockfile alone selects the manager when there is no package.json" {
	make_build claude
	stub_cmd pnpm 'echo "pnpm $*"'
	: >"$PROJECT/pnpm-lock.yaml"
	run_fallback
	[ "$output" = "pnpm dlx @demo/mcp --stdio" ]
}

@test "an unrecognised devEngines manager falls through to the lockfiles" {
	make_build claude
	stub_cmd pnpm 'echo "pnpm $*"'
	: >"$PROJECT/pnpm-lock.yaml"
	printf '{"devEngines": {"packageManager": {"name": "deno"}}}\n' >"$PROJECT/package.json"
	run_fallback
	[ "$output" = "pnpm dlx @demo/mcp --stdio" ]
}

@test "an unrecognised packageManager falls through to the lockfiles" {
	make_build claude
	stub_cmd yarn 'echo "yarn $*"'
	: >"$PROJECT/yarn.lock"
	printf '{"packageManager": "deno@2.0.0"}\n' >"$PROJECT/package.json"
	run_fallback
	[ "$output" = "yarn dlx @demo/mcp --stdio" ]
}

@test "an unrecognised manager with no lockfile falls through to npm" {
	make_build claude
	stub_npx 'echo "npx $*"'
	printf '{"packageManager": "deno@2.0.0"}\n' >"$PROJECT/package.json"
	run_fallback
	[ "$output" = "npx --yes @demo/mcp --stdio" ]
}

@test "a detected manager missing from PATH falls back to npx and says so" {
	make_build claude
	bare_path
	ln -sf "$(command -v jq)" "$TMP/bare/jq"
	rm -f "$TMP/stub/pnpm"
	stub_npx 'echo "npx $*"'
	printf '{"devEngines": {"packageManager": {"name": "pnpm"}}}\n' >"$PROJECT/package.json"
	launcher 'server_exec_bin demo-mcp @demo/mcp --stdio'
	PATH="$TMP/stub:$TMP/bare" run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$output" = "npx --yes @demo/mcp --stdio" ]
	[[ "$stderr" == *"pnpm was not found on PATH"* ]]
	[[ "$stderr" == *'Falling back to "npx --yes @demo/mcp"'* ]]
}

@test "without jq the packageManager field is still read and devEngines is ignored" {
	make_build claude
	bare_path
	stub_cmd yarn 'echo "yarn $*"'
	stub_cmd pnpm 'echo "pnpm $*"'
	printf '{"devEngines": {"packageManager": {"name": "pnpm"}}, "packageManager": "yarn@4.0.0"}\n' >"$PROJECT/package.json"
	launcher 'server_exec_bin demo-mcp @demo/mcp --stdio'
	PATH="$TMP/stub:$TMP/bare" run_launcher CLAUDE_PROJECT_DIR="$PROJECT"
	[ "$output" = "yarn dlx @demo/mcp --stdio" ]
}

@test "a non-object devEngines degrades to packageManager" {
	make_build claude
	stub_cmd bunx 'echo "bunx $*"'
	printf '{"devEngines": "pnpm", "packageManager": "bun@1"}\n' >"$PROJECT/package.json"
	run_fallback
	[ "$output" = "bunx @demo/mcp --stdio" ]
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
