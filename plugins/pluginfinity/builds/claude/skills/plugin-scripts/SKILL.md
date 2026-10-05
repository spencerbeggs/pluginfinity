---
name: plugin-scripts
description: >-
  Use when writing a bash script a pluginfinity plugin ships outside hooks, such as a skill's scripts/,
  or any plugin script that calls gh, git, aws, kubectl or another CLI. Covers finding the plugin root
  and data directory on each host, calling CLIs without leaking or misusing credentials, persistent
  state, the session-env pattern, and testing scripts with bats.
paths:
  - "**/skills/**/scripts/**"
---

# Writing a plugin script

A plugin script runs in the user's shell environment, on a host you do not control. Resolve paths from what the host provides, treat inherited credentials as hostile, and keep state out of the plugin root. Hook scripts follow the `hook-authoring` skill instead.

## Where am I

- The plugin root is `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Copilot (Claude Code plugins reference; pluginfinity hooks reference). Copilot also sets `CLAUDE_PLUGIN_ROOT` in a hook's environment (pluginfinity hooks reference).
- The data directory is `${CLAUDE_PLUGIN_DATA}` on Claude Code and `${COPILOT_PLUGIN_DATA}` on Copilot (Claude Code plugins reference; Copilot hooks configuration reference).
- Claude Code does not put these variables in the environment of commands the agent runs through the Bash tool. It substitutes a `${...}` reference written in skill, command or agent Markdown when it loads (Claude Code plugins reference). Write the path into the skill's Markdown, or let the script find itself.
- A script always knows where it sits, so it can find its own plugin's files from `$0`. Never walk up from `$0` to find the user's project: that works only in a local checkout, because an installed plugin lives in a cache.

```bash
plugin_root="${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}}"
data_dir="${CLAUDE_PLUGIN_DATA:-${COPILOT_PLUGIN_DATA:-}}"
```

- The second line leaves `data_dir` empty on a host that sets neither. Test it before you write: `[ -n "$data_dir" ] || { echo "no plugin data directory" >&2; exit 1; }`.
- Do not write `${COPILOT_PLUGIN_ROOT}` or `${PLUGIN_DATA}` in a script. The Copilot CLI plugin format reference documents no `COPILOT_PLUGIN_ROOT`, and `PLUGIN_DATA` is a placeholder for MCP and agent config, not a variable a script can rely on. Either expands to nothing.
- For the user's project, use `${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}`. Hooks should call `hook_plugin_root` and `hook_project_dir` instead.

## Calling another CLI

Tools such as `gh`, `aws` and `kubectl` read their own environment variables before their keyring, profile or context. A stale `GH_TOKEN` in the user's shell beats a good `gh auth login`, and the plugin never notices.

- Namespace the plugin's own variable (`MYPLUGIN_GH_TOKEN`) and translate it to `GH_TOKEN` for one call. Never tell the user to export `GH_TOKEN`.
- Scrub the inherited token at every call site, with a per-call override (`VAR= cmd`, `env -u VAR cmd`) or a subshell `( unset VAR; cmd )`. Never put `unset` at the top of the script: it changes the environment for every later command.
- Scrub at the check and at the use. A probe that scrubs while the write call is bare passes against the keyring, then writes with the stale token. List every call site and confirm they agree.
- `gh auth status` exits non-zero when an invalid env token sits beside a valid keyring entry. Control the environment first, then read the exit code, which `_gh_auth_ok` below does.
- Set `GH_PAGER=cat` so `gh` never waits on a pager.
- Pass `--context` to `kubectl` and `helm`, and `--profile` to `aws`, whenever the plugin assumes a cluster or account. Their environment variables (`KUBECONFIG`, `AWS_PROFILE`) otherwise decide.
- Capture a status with `out=$(cmd 2>&1) || rc=$?`. After `cmd || true`, `$?` is always 0.

Copy this wrapper into the plugin's own `scripts/lib/`. It is valid bash 3.2.

```bash
_gh() {
	local token=""
	if [ -n "${MYPLUGIN_GH_TOKEN:-}" ]; then
		token="$MYPLUGIN_GH_TOKEN"
	elif [ -n "${GH_TOKEN:-}" ]; then
		token="$GH_TOKEN"
	elif [ -n "${GITHUB_TOKEN:-}" ]; then
		token="$GITHUB_TOKEN"
	fi
	if [ -n "$token" ]; then
		GH_TOKEN="$token" GITHUB_TOKEN="$token" GH_PAGER=cat gh "$@"
	else
		# An empty GH_TOKEN counts as a token, so remove it and let gh use the keyring.
		env -u GH_TOKEN -u GITHUB_TOKEN GH_PAGER=cat gh "$@"
	fi
}
_gh_auth_ok() { _gh auth status >/dev/null 2>&1; }
```

Call `_gh pr view`, never bare `gh pr view`. The fallback to `GH_TOKEN` and `GITHUB_TOKEN` keeps the script working in CI, where they are the normal way in.

## State

- Write persistent files to the data directory, never the plugin root. The plugin root is the install directory, which changes on every update (Claude Code plugins reference).
- Claude Code creates `${CLAUDE_PLUGIN_DATA}` on first reference, keeps it across updates and deletes it on uninstall. Create subdirectories with `mkdir -p "$data_dir/cache"`.
- Do not rebuild `~/.claude/plugins/data/<id>/` by hand. The `<id>` form is the host's business.
- A script's working directory is whatever the agent last used. Do not assume it is the project root.

## Sharing values between hooks (Claude only)

A `SessionStart` hook can append `export` lines to `$CLAUDE_ENV_FILE`, and Claude Code carries them into later Bash-tool commands. The variable is set only for `SessionStart`, `Setup`, `CwdChanged` and `FileChanged` hooks (Claude Code hooks reference). Other hook subprocesses do not see those exports, so a producer also writes a plugin-owned file that a consumer sources. The pluginfinity hook library has no helper for this yet, so write both halves by hand.

```bash
env_dir="${HOME}/.claude/session-env/${session_id}"
mkdir -p "$env_dir"
printf 'export MYPLUGIN_PROJECT_DIR=%q\n' "$project_dir" > "$env_dir/myplugin-hook.sh"
if [ -n "${CLAUDE_ENV_FILE:-}" ] && ! grep -q '^export MYPLUGIN_PROJECT_DIR=' "$CLAUDE_ENV_FILE" 2>/dev/null; then
	grep '^export MYPLUGIN_PROJECT_DIR=' "$env_dir/myplugin-hook.sh" >> "$CLAUDE_ENV_FILE"
fi
```

- Quote every value with `printf '%q'`, so a value with spaces or shell metacharacters cannot break the sourced file or run injected content.
- Guard each append to `$CLAUDE_ENV_FILE` with `grep -q`. `/resume` fires `SessionStart` again, and a bare `>>` stacks duplicate lines.
- Overwrite the per-session file with `>`. It belongs to one session and one plugin.
- A consumer validates the session id (letters, digits, `-`, `_` only) before it builds the path, then runs `. "$env_dir/myplugin-hook.sh"` when the file exists.
- The `~/.claude/session-env/` layout is plugin-bot's convention, not a host documented path.

## Testing a script

- Write plain bats tests in `__test__/`, with fixtures in `__test__/fixtures/`.
- Run the script under `env -i` and pass every variable it reads (`HOME`, `PATH`, `CLAUDE_PLUGIN_DATA`, `MYPLUGIN_GH_TOKEN`), so the user's real environment never decides a result.
- Put a stub `gh` first on `PATH` that prints its arguments and `GH_TOKEN`, and assert the stale token never reaches it.
- The pluginfinity helper's `run_hook` is for hooks only. It feeds a hook payload on stdin and reads a hook response.
- macOS ships bash 3.2, so the script must avoid `${var^^}`, `declare -A`, `mapfile` and `local -n`.
- Run `bats --recursive __test__`.
