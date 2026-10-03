# Hooks

Hooks are declared once, in the config's `hooks`, keyed by Claude Code event name. Each event holds a
list of entries; each entry is either a script or a command.

```ts
hooks: {
  SessionStart: [{ script: "hooks/session-start.sh", timeout: 5 }],
  PreToolUse: [{ matcher: "Bash", command: 'bash "${PLUGIN_ROOT}/hooks/guard.sh" --quiet' }],
},
```

## Entries

| Field | Meaning |
| :-- | :-- |
| `script` | A path from the plugin root. pluginfinity writes the command for each host |
| `args` | Arguments to a `script`, quoted for bash where they need it |
| `command` | A shell command as written. Its one placeholder is `${PLUGIN_ROOT}`, spelled each host's way |
| `matcher` | Which tools or sources the hook applies to, in Claude Code's terms |
| `timeout` | Seconds, a positive whole number |
| `fallback` | What a host without the event does: `"fail"`, the default, or `"omit"` |

An entry has exactly one of `script` or `command`.

## How scripts run

With `scripts.invoke: "bash"`, the default, a script entry becomes `bash "<root>/<script>"`, so the file
needs no executable bit. That suits repositories that keep scripts in git without it. With `"exec"`, the
command is the quoted path alone, and the build fails if the script is not executable.

The plugin root is `${CLAUDE_PLUGIN_ROOT}` on Claude Code and `${PLUGIN_ROOT}` on Copilot. Copilot also
sets `CLAUDE_PLUGIN_ROOT` in a hook's environment, so a script can read either.

## What ships

Every host gets the source `hooks/` directory whole, so a script can source helpers the config never
names, except scripts only another host's hooks run. Keep test data out of `hooks/`. A script outside
`hooks/` ships to the hosts that run it.

pluginfinity writes the hooks file itself: `hooks/hooks.json` on Claude Code and
`com.github.copilot/hooks/hooks.json` on Copilot. A source file at either path fails the build.

## Events across hosts

Copilot runs a hook declared under a Claude Code event name it shares, with a Claude-shaped payload.
These have that form: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `PermissionRequest`, `Stop`, `SubagentStop` and `PreCompact`. `SubagentStart`
and `Notification` map to Copilot's `subagentStart` and `notification`. Copilot has no other Claude
Code event.

An event a host lacks fails the build unless every entry for it sets `fallback: "omit"`, which skips it
there. To give one host a different script for an event, override that event under the host's key in the
config.

Copilot's output contract differs per event; a script that serves both hosts may need to print a
different shape on each. Copilot honours a flat `{ "additionalContext": ... }` from `SessionStart`, and
Claude Code's `hookSpecificOutput` deny shape from `PreToolUse`.
