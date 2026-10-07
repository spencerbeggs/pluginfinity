# Hook recipes

Each recipe is a real hook from pluginfinity's dogfood plugin, `plugins/dogfood/`. Bats tests it against the Claude Code and Copilot builds, and a drift test keeps every recipe's blocks identical to the dogfood file. Copy a recipe whole, then change only what its last line names.

## Recipe: Command guard

Blocks a Bash command before it runs. It relies on `PreToolUse` and on the library's `hook_deny`, which maps to each host's own deny shape. Check the event in the `hook-events` skill's table before you copy it; `hook_supports` works only inside a sourced hook.

```ts
hooks: {
	PreToolUse: [{ matcher: "Bash", script: "hooks/pre-tool-use.sh", timeout: 5, failClosed: true }],
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

cmd=$(hook_input tool_input.command)
case "$cmd" in
*pf-dogfood-deny*) hook_deny "pluginfinity-dogfood denies commands holding pf-dogfood-deny" ;;
*pf-dogfood-allow*) hook_allow "pluginfinity-dogfood approves commands holding pf-dogfood-allow" ;;
# The entry is failClosed: a crash here must deny, not let the call through.
*pf-dogfood-closed-crash*) false ;;
*) hook_noop ;;
esac
```

```bash
@test "PreToolUse denies the marker command on both targets" {
	run_hook claude hooks/pre-tool-use.sh pretooluse.deny.json
	assert_hook_json .hookSpecificOutput.permissionDecision deny
	run_hook copilot hooks/pre-tool-use.sh pretooluse.deny.json
	assert_hook_json .permissionDecision deny
}
```

**Change for your plugin:** the marker string, the denial message and the `Bash` matcher. Match a different tool by changing the matcher. `failClosed: true` makes a crash in this guard deny the call instead of letting it through; drop it for a hook that must not block work when it breaks. The `allow` line shows `hook_allow` taking its reason first.

## Recipe: Startup context

Adds context when a session starts. It relies on `SessionStart` and on `hook_context`; `hook_supports` reports that both hosts accept added context on this event.

```ts
hooks: {
	SessionStart: [{ matcher: "startup", script: "hooks/session-start.sh", timeout: 5 }],
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

source=$(hook_input source)
hook_context "pluginfinity-dogfood is loaded on $(hook_host) ($source)"
```

```bash
@test "SessionStart adds context naming the host, on both targets" {
	run_hook claude hooks/session-start.sh sessionstart.startup.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood is loaded on claude (startup)"
	run_hook copilot hooks/session-start.sh sessionstart.startup.json
	assert_hook_json .additionalContext "pluginfinity-dogfood is loaded on copilot (startup)"
}
```

**Change for your plugin:** the context text. Keep it short, since it enters every session. The `startup` matcher limits it to fresh sessions, not `resume` or `clear`. Copilot ignores a `SessionStart` matcher, so the build passes it to the script and the library applies it, which works because this is a `script` entry that sources `hook.sh`; the build lists a `hook-matcher-runtime` note.

## Recipe: Post-edit reaction

Reacts after a file edit by naming the file. It relies on `PostToolUse` and `hook_context`. The script reads `tool_input.file_path`; Copilot passes the same value as `path` (Copilot CLI 1.0.91), and the library reads either shape.

```ts
hooks: {
	PostToolUse: [{ matcher: "Edit|Write", script: "hooks/post-edit.sh", timeout: 5 }],
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

file=$(hook_input tool_input.file_path)
if [ -n "$file" ]; then
	hook_context "pluginfinity-dogfood saw an edit to $file"
else
	hook_noop
fi
```

```bash
@test "PostToolUse names the edited file on both targets and both input shapes" {
	run_hook claude hooks/post-edit.sh posttooluse.edit.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood saw an edit to /tmp/pf-dogfood-edit.txt"
	run_hook copilot hooks/post-edit.sh posttooluse.edit.copilot.json
	assert_hook_json .additionalContext "pluginfinity-dogfood saw an edit to /tmp/pf-dogfood-edit.txt"
}
```

**Change for your plugin:** the matcher (the tool names for your editor tools) and the message.

## Recipe: Stop gate

Keeps the agent working while a marker file exists. It relies on `Stop` and `hook_block`. A blocked stop runs the hook again with `stop_hook_active` set, so the script must let that second run proceed. Otherwise it keeps the agent going until the host's continuation cap (eight on Claude Code). The test puts the marker file in the helper's default project, `$BATS_TEST_TMPDIR/project`, which `hook_fixture` uses as the input's `cwd` and `run_hook` gives Claude Code as `CLAUDE_PROJECT_DIR`. One leg sends a fixture with a null `cwd`, so `hook_project_dir` falls back to `CLAUDE_PROJECT_DIR`.

```ts
hooks: {
	Stop: [{ script: "hooks/stop.sh", timeout: 5 }],
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

stop_hook_active=$(hook_input stop_hook_active)
if [ "$stop_hook_active" != true ] && [ -e "$(hook_project_dir)/.pf-dogfood-block" ]; then
	hook_block "pluginfinity-dogfood: delete .pf-dogfood-block, then stop"
else
	hook_noop
fi
```

```bash
@test "Stop blocks once when the marker file exists" {
	mkdir -p "$BATS_TEST_TMPDIR/project/.git"
	touch "$BATS_TEST_TMPDIR/project/.pf-dogfood-block"
	run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":false}')"
	assert_hook_json .decision block
	run_hook copilot hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":false}')"
	assert_hook_json .decision block
	run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":false,"cwd":null}')"
	assert_hook_json .decision block
	run_hook claude hooks/stop.sh "$(hook_fixture Stop '{"stop_hook_active":true}')"
	assert_hook_noop
}
```

**Change for your plugin:** the marker file path and the block reason.

## Recipe: Subagent context

Adds context when a subagent starts. It relies on `SubagentStart` and `hook_context`. Claude Code adds the context to the subagent's conversation; Copilot places it at the top of the subagent's first prompt (Copilot CLI 1.0.91).

```ts
hooks: {
	SubagentStart: [{ script: "hooks/subagent-start.sh", timeout: 5 }],
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input

hook_context "pluginfinity-dogfood subagent context"
```

```bash
@test "SubagentStart adds context on both targets" {
	run_hook claude hooks/subagent-start.sh subagentstart.json
	assert_hook_json .hookSpecificOutput.additionalContext "pluginfinity-dogfood subagent context"
	run_hook copilot hooks/subagent-start.sh subagentstart.json
	assert_hook_json .additionalContext "pluginfinity-dogfood subagent context"
}
```

**Change for your plugin:** the context text.

## A capability one host lacks

Not a tested recipe: a pattern to combine with one. When the response you want is honoured on one host only, branch on `hook_supports` and fall back to the nearest response the other host honours. This is not a host branch: it asks the library about the capability, so it stays right when a host gains it. For example, `hook_block` on `PostToolUse` works on Claude Code and does nothing on Copilot, which does honour `hook_context` there:

```bash
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

file=$(hook_input tool_input.file_path)
if [ -z "$file" ] || mytool check "$file" >/dev/null 2>&1; then
	hook_noop
elif hook_supports block; then
	hook_block "mytool check failed on $file; fix it before going on"
else
	hook_context "mytool check failed on $file; fix it before going on"
fi
```

Test both branches: assert `.decision` is `block` on claude and `.additionalContext` carries the message on copilot. Check which responses each host honours for the event in the `hook-events` skill's table.
