---
type: Measurement
title: Copilot plugin hook environment, 2026-10-02
description: What a Copilot CLI 1.0.91 plugin hook command sees for the plugin root, plugin data, working directory and placeholder expansion, measured with a probe plugin both loaded through --plugin-dir and installed.
tags:
  - portability
  - github
status: draft
stale_after: 2027-01-01T00:00:00Z
justifies: ../roadmaps/pluginfinity-first-release.md
sources:
  - id: owner-probe-run
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The owner's run of the pluginfinity-probe plugin under Copilot CLI 1.0.91, with its output pasted back
  - id: copilot-cli-plugin-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
    title: GitHub Copilot CLI plugin reference
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:13:15Z
  body_sha256: c7536a95fa4ea1857ea6c16906d66263ebef4e8c98515da294f82c8b71d4cba4
---

# Copilot plugin hook environment, 2026-10-02

## Method

The Copilot docs document `${PLUGIN_ROOT}` for MCP server, LSP and plugin-agent `mcp-servers` config, but not for hook commands.[^copilot-cli-plugin-reference] To settle it, a probe plugin in the Agent Plugins 1.0 layout (a root `plugin.json` with the 1.0.0 `$schema`, and `com.github.copilot/hooks/hooks.json`) declared three `sessionStart` command hooks:

- **inline** wrote `pwd`, the full environment, and `'${PLUGIN_ROOT}'`, `'${CLAUDE_PLUGIN_ROOT}'` and `'${COPILOT_PLUGIN_ROOT}'` inside single quotes, so that only a substitution by Copilot itself, never by bash, could change them.
- **relative** ran `./scripts/probe.sh`.
- **plugin-root** ran `"${PLUGIN_ROOT}/scripts/probe.sh"`.

The script recorded its `$0`, `pwd`, the plugin variables and its stdin. The repository owner ran it twice with Copilot CLI 1.0.91 on macOS: loaded in place with `copilot --plugin-dir <probe> -p "reply with ok"`, and installed with `copilot plugin install <probe>` followed by `copilot -p "reply with ok"`.[^owner-probe-run] The installed copy lived at `~/.copilot/installed-plugins/_direct/pluginfinity-probe`.

## Results

| Observation | Result |
| :-- | :-- |
| Hook working directory | The plugin root (the probe directory in place, the installed copy once installed), not the session's project directory (which arrives as `cwd` in the stdin payload) |
| `./scripts/probe.sh` | Ran |
| `"${PLUGIN_ROOT}/scripts/probe.sh"` | Ran |
| `${PLUGIN_ROOT}` in the command string | Substituted by Copilot with the plugin root |
| `${CLAUDE_PLUGIN_ROOT}` in the command string | Substituted by Copilot with the plugin root |
| `${COPILOT_PLUGIN_ROOT}` in the command string | Left as literal text |
| `PLUGIN_ROOT`, `COPILOT_PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT` in the environment | All set to the plugin root |
| `COPILOT_PLUGIN_DATA` in the environment | Set, to `~/.copilot/plugin-data/_direct/<hash>` |
| `PLUGIN_DATA` in the environment | Unset |
| `sessionStart` stdin | `sessionId`, `timestamp`, `cwd`, `source` (`new`) and `initialPrompt` |

All three hooks ran in both runs, and every row held for both; the plugin root followed the copy that was loaded.[^owner-probe-run]

## What this rules in and out

- A plugin hook command can reach its own files three ways, loaded in place or installed: a path relative to the plugin root, `${PLUGIN_ROOT}`, or `${CLAUDE_PLUGIN_ROOT}`. A command written for Claude Code with `${CLAUDE_PLUGIN_ROOT}` works unchanged.
- `${COPILOT_PLUGIN_ROOT}` is not safe as text in a command, though it is safe as an environment variable read by a script.
- Persistent data is reachable only as `$COPILOT_PLUGIN_DATA`, not `$PLUGIN_DATA`.
- It covers a direct local-path install, which Copilot warns is deprecated in favour of `plugin@marketplace`. It does not cover a marketplace install, Windows, or the `powershell` key.

[^owner-probe-run]: conversation with the repository owner, 2026-10-02
[^copilot-cli-plugin-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
