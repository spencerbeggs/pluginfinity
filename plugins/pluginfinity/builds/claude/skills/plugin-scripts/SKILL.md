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

Who launches the script decides which variables it has.

- A script a hook runs inherits the host's variables. On Claude Code they are `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_PROJECT_DIR` (Claude Code hooks reference). On Copilot CLI 1.0.91 (measured 2026-10-02, a hook command) `PLUGIN_ROOT`, `COPILOT_PLUGIN_ROOT` and `CLAUDE_PLUGIN_ROOT` were all set to the plugin root, and `COPILOT_PLUGIN_DATA` was set. `PLUGIN_DATA` was unset.
- A script a skill runs through the Bash tool does not inherit them. Claude Code keeps these variables out of the environment of commands the agent runs through the Bash tool. It substitutes a `${...}` reference written in skill, command or agent Markdown when the skill loads (Claude Code plugins reference). Hand the script its paths: as arguments, or as environment the caller sets on the command line. How Copilot exposes the plugin root to skill scripts is undocumented, so do not rely on a variable there.
- A script can always find its own plugin's files from `$0`. Never walk up from `$0` to find the user's project: that works only in a local checkout, because an installed plugin lives in a cache.

```bash
plugin_root="${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}}"
data_dir="${CLAUDE_PLUGIN_DATA:-${COPILOT_PLUGIN_DATA:-}}"
```

- The first line works anywhere, because `$0` is the last resort. The second leaves `data_dir` empty when the caller handed none, and every script that needs state must decide what that means. See State.
- In a hook command's text on Copilot, write `${PLUGIN_ROOT}` or `${CLAUDE_PLUGIN_ROOT}`. Copilot substitutes both. It leaves `${COPILOT_PLUGIN_ROOT}` as literal text there (measured, Copilot CLI 1.0.91, 2026-10-02), although the variable is set for a script to read.
- `${PLUGIN_DATA}` is unset in a Copilot hook's environment (same measurement). Use `COPILOT_PLUGIN_DATA`.
- For the user's project, use `${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}`, or take it as an argument. Hooks should call `hook_plugin_root` and `hook_project_dir` instead.

## Calling another CLI

Tools such as `gh`, `aws` and `kubectl` read their own environment variables before their keyring, profile or context. A stale `GH_TOKEN` in the user's shell beats a good `gh auth login`, and the plugin never notices.

- Namespace the plugin's own variable (`MYPLUGIN_GH_TOKEN`) and translate it to `GH_TOKEN` for one call. Never tell the user to export `GH_TOKEN`.
- Scrub the inherited token, and `GH_HOST` and `GH_REPO`, at every call site, with a per-call override (`VAR= cmd`, `env -u VAR cmd`) or a subshell `( unset VAR; cmd )`. Never put `unset` at the top of the script: it changes the environment for every later command.
- Scrub at the check and at the use. A probe that scrubs while the write call is bare passes against the keyring, then writes with the stale token. List every call site and confirm they agree.
- `gh auth status` exits non-zero when an invalid env token sits beside a valid keyring entry. Control the environment first, then read the exit code. `_gh_auth_ok` below does that only for the token it resolves.
- An inherited `GH_HOST` or `GH_REPO` points `gh` at the wrong host or repository. Scrub them too, and pass `--repo` when the plugin means a specific one.
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
		env -u GH_HOST -u GH_REPO GH_TOKEN="$token" GITHUB_TOKEN="$token" GH_PAGER=cat gh "$@"
	else
		# An empty GH_TOKEN counts as a token, so remove it and let gh use the keyring.
		env -u GH_TOKEN -u GITHUB_TOKEN -u GH_HOST -u GH_REPO GH_PAGER=cat gh "$@"
	fi
}
_gh_auth_ok() { _gh auth status >/dev/null 2>&1; }
```

Call `_gh pr view`, never bare `gh pr view`. The fallback to `GH_TOKEN` and `GITHUB_TOKEN` keeps the script working in CI, where they are the normal way in. The limit: with no `MYPLUGIN_GH_TOKEN`, the wrapper uses an inherited `GH_TOKEN`, so `_gh_auth_ok` then tests that token. A stale one still fails the check even when the keyring is good. To prefer the keyring, drop the two fallback branches.

## State

- Write persistent files to the data directory, never the plugin root. The plugin root is the install directory, which changes on every update (Claude Code plugins reference).
- Claude Code creates `${CLAUDE_PLUGIN_DATA}` on first reference, keeps it across updates and deletes it on uninstall (Claude Code plugins reference). A script a skill runs has no such variable unless the caller passes the path.
- Give the script a defined fallback when `data_dir` is empty. Either fail with a message that names the missing argument, or fall back to a cache under the user's own state directory, for example `${XDG_STATE_HOME:-$HOME/.local/state}/myplugin`.
- Create subdirectories with `mkdir -p "$data_dir/cache"` and never write under `plugin_root`.
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
