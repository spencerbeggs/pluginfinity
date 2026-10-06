---
type: Reference
title: Claude Code plugin format
description: The on-disk layout, plugin.json manifest fields, component path rules, path variables, hooks shape and install-time copying rules of a Claude Code plugin, as the official docs and the SchemaStore manifest schema state them.
status: draft
tags:
  - portability
stale_after: 2027-01-01T00:00:00Z
sources:
  - id: cc-plugins-create
    resource: https://code.claude.com/docs/en/plugins/create.md
    title: Create a Claude Code plugin
    last_modified: 2026-10-02T00:00:00Z
  - id: cc-plugins-reference
    resource: https://code.claude.com/docs/en/plugins-reference.md
    title: Plugin manifest reference
    last_modified: 2026-10-02T00:00:00Z
  - id: cc-plugin-schema
    resource: https://www.schemastore.org/claude-code-plugin-manifest.json
    title: Claude Code Plugin Manifest (SchemaStore JSON Schema)
    last_modified: 2026-10-02T00:00:00Z
  - id: cc-plugins-components
    resource: https://code.claude.com/docs/en/plugins/components.md
    title: Plugin components
    last_modified: 2026-10-02T00:00:00Z
  - id: cc-plugins-loading
    resource: https://code.claude.com/docs/en/plugins/loading.md
    title: How Claude Code loads plugins
    last_modified: 2026-10-02T00:00:00Z
  - id: cc-hooks
    resource: https://code.claude.com/docs/en/hooks.md
    title: Hooks reference
    last_modified: 2026-10-03T00:00:00Z
  - id: cc-host-marketplace
    resource: https://code.claude.com/docs/en/plugins/host-marketplace.md
    title: Host a marketplace
    last_modified: 2026-10-02T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-03T19:33:34Z
  body_sha256: 2c8623a0205f4af1cffd537bb4fcf8e692fe7f78649e8647d36f352fe4ef868a
---

# Claude Code plugin format

A Claude Code plugin is a directory, the plugin root, holding an optional manifest at `.claude-plugin/plugin.json` and component files in fixed default locations under the root.[^cc-plugins-create] The manifest reference is the authoritative field list; the SchemaStore schema (`$id` `https://json.schemastore.org/claude-code-plugin-manifest.json`, draft-07, `$comment` "Generated on 2026-04-23T05:09:41.810Z") lags it in several places, listed at the end.[^cc-plugins-reference][^cc-plugin-schema]

## Layout

Only `plugin.json` goes inside `.claude-plugin/`; components saved there don't load.[^cc-plugins-create] The manifest is optional: without it Claude Code loads what it finds in the standard layout, and the plugin name comes from the marketplace entry, or from the directory name under `--plugin-dir`.[^cc-plugins-reference]

| Component | Default location | Contents |
| :- | :- | :- |
| Manifest | `.claude-plugin/plugin.json` | Metadata and configuration. Optional |
| Skills | `skills/` | One `<name>/SKILL.md` per skill. A plugin with `SKILL.md` at its root, no `skills/` and no `skills` key loads as a single skill |
| Commands | `commands/` | Flat Markdown command files. Docs say prefer `skills/` for new plugins |
| Agents | `agents/` | Agent Markdown files. Subfolders are part of the agent name |
| Hooks | `hooks/hooks.json` | Hook configuration |
| MCP servers | `.mcp.json` | MCP server definitions |
| LSP servers | `.lsp.json` | LSP server configurations |
| Output styles | `output-styles/` | Output style Markdown files |
| Workflows | `workflows/` | Workflow `.js` files |
| Themes | `themes/` | Theme JSON files |
| Monitors | `monitors/monitors.json` | The monitors array |
| Executables | `bin/` | On the Bash tool's `PATH` while the plugin is enabled |
| Settings | `settings.json` | `agent` and `subagentStatusLine` defaults |

Source: the reference's standard layout table.[^cc-plugins-reference] Skill and agent file contents (frontmatter) are out of scope here.

Further layout facts:

- `bin/` entries come after the user's own `PATH` entries, so a plugin can't shadow system commands. claude.ai and Cowork don't install a plugin that has a top-level `bin/` directory.[^cc-plugins-components]
- A root `settings.json` applies only `agent` and `subagentStatusLine`; other keys are dropped. When both `settings.json` (with at least one supported key) and the manifest `settings` key exist, the file wins.[^cc-plugins-components]
- A `CLAUDE.md` at the plugin root isn't loaded as context, and `claude plugin validate` warns about it.[^cc-plugins-reference]
- A `scripts/` folder is a convention only; hooks reference scripts by path.[^cc-plugins-components]

## Manifest fields

`name` is the only required key (schema: `"required": ["name"]`).[^cc-plugins-reference][^cc-plugin-schema] An unrecognized top-level key is stripped and the plugin loads, with a `claude plugin validate` warning. Inside `userConfig` options, `channels` entries, `lspServers` configs and `monitors` entries, an unknown key is an error and the plugin doesn't load.[^cc-plugins-reference] A "path" is a string relative to the plugin root, such as `"./custom/commands"`.

| Field | Type | Required | Notes |
| :- | :- | :- | :- |
| `$schema` | string | no | Ignored at load time |
| `name` | string | yes | Schema: `minLength: 1`. Docs: non-empty, no spaces, `@`, `:`, path separators, control or bidi characters; use kebab-case. Every component is namespaced under it (`deploy-tools:reviewer`). `claude plugin validate` errors on names starting `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`, on exactly `claude`, `anthropic`, `anthropics`, `claude-code`, `claude-mods`, and on `official` beside `claude`/`anthropic`; warns on `claude`/`anthropic`/`anthropics` as a whole word elsewhere. Only `init`, `tag` and `validate` check this |
| `displayName` | string | no | UI name in place of `name`; not used for namespacing. A marketplace entry's `displayName` wins. Not in schema |
| `version` | string | no | Not checked against semver. Pins users to that version until changed. Validate warns if missing |
| `description` | string | no | Validate warns if missing |
| `author` | object | no | `name` (string, required, `minLength: 1`), `email` (string), `url` (string). Validate warns if missing |
| `homepage` | string | no | Must parse as a URL or the plugin fails to load. Schema: `format: uri` |
| `repository` | string | no | Not validated. String only |
| `license` | string | no | SPDX identifier |
| `keywords` | array of strings | no | Discovery tags |
| `metadata` | object | no | Free-form, not read by Claude Code. Needs v2.1.222+. Not in schema |
| `icon` | string | no | Path to an image inside the plugin, for Anthropic's directory listing; ignored at load. Not in schema |
| `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl` | string | no | `https://` URLs for Anthropic's directory; ignored at load. Unknown-field warnings before v2.1.281. Rejected as unknown in a marketplace entry. Not in schema |
| `defaultEnabled` | boolean | no | Default `true`. Marketplace entry's value overrides. Not in schema |
| `dependencies` | array of string or object | no | `"name"`, `"name@marketplace"`, or `{ name, marketplace, version }`. Bare names resolve against this plugin's marketplace. Schema string pattern `^[A-Za-z0-9][-A-Za-z0-9._]*(@[A-Za-z0-9][-A-Za-z0-9._]*)?(@\^[^@]*)?$`; object `name` (required) and `marketplace` each match `^[A-Za-z0-9][-A-Za-z0-9._]*$` |
| `settings` | object | no | Only `agent` and `subagentStatusLine` take effect |
| `userConfig` | object | no | Keys match `^[A-Za-z_]\w*$`. Values strict; see below |
| `types` | path | no | `.d.ts` declaring a mod's `$.state` values and `$` nouns. Not in schema |
| `channels` | array of object | no | Strict entries: `server` (required, string, `minLength: 1`, must be a key in this plugin's `mcpServers`), `displayName`, `userConfig` (same shape as top-level) |
| `skills` | path or array of paths | no | Directories only (each a directory of `<name>/SKILL.md` folders, or one folder holding `SKILL.md`). `"."` or `"./"` names the root. Adds to the default `skills/` scan |
| `commands` | path, array of paths, or object | no | `.md` files or directories, or a map of command name to `{ source \| content, description, argumentHint, model, allowedTools }`; exactly one of `source`/`content`. Replaces the default `commands/` scan |
| `agents` | path or array of paths | no | `.md` files only, no directories. Replaces the default `agents/` scan |
| `hooks` | path, object, or array of either | no | `.json` files (with the `"hooks"` wrapper) or an inline event map (no wrapper). Merged with `hooks/hooks.json` |
| `mcpServers` | path, object, or array of either | no | `.json` file (an `mcpServers` map), `.mcpb`/`.dxt` bundle path or `https://` URL (extracted to `.mcpb-cache/` under the root), or inline map keyed by server name. Loaded after `.mcp.json`; a later server name replaces an earlier one |
| `lspServers` | path, object, or array of either | no | `.json` file or inline map. Loaded after `.lsp.json`; later name replaces earlier |
| `outputStyles` | path or array of paths | no | Files or directories. Replaces the default `output-styles/` scan |
| `workflows` | path or array of paths | no | `.js` files or directories. Replaces `workflows/`. Not in schema |
| `experimental` | object | no | Holds `themes`, `monitors`, `evals`. Not in schema |
| `experimental.themes` | path or array of paths | no | Replaces `themes/`. Top-level `themes` still loads with a warning |
| `experimental.monitors` | path or inline array | no | Defaults to `monitors/monitors.json`. Top-level `monitors` still loads with a warning. Interactive sessions only |
| `experimental.evals` | path or array of paths | no | Eval directory when not `evals/`; not a component path, `./` optional, only the first array entry is used |

Source for the table: the reference's fields table and per-field sections, with schema constraints added.[^cc-plugins-reference][^cc-plugin-schema]

Nested strict objects, per the reference and schema:[^cc-plugins-reference][^cc-plugin-schema]

- **`userConfig` option**: `type` (required; `string`, `number`, `boolean`, `directory`, `file`), `title` (required), `description` (required), `required`, `default` (string, number, boolean or array of strings), `options` (strings of 1 to 64 characters; `string` type only, not with `multiple` or `sensitive`; v2.1.271+), `multiple`, `sensitive`, `min`/`max`. Non-sensitive values go under `pluginConfigs` in the user's `settings.json`; sensitive values go to the platform credential store. Values are referenced as `${user_config.KEY}` (MCP config, LSP config, exec-form hook `args`, skill and agent content; non-sensitive only in content) or read as `CLAUDE_PLUGIN_OPTION_<KEY>` (uppercased) in hook processes. Shell-form hook commands, monitor commands and MCP `headersHelper` reject `${user_config.*}`.
- **LSP server config**: `command` (required, `minLength: 1`; no spaces unless it starts with `/`), `extensionToLanguage` (required; keys start with a dot, schema `minLength: 2`), `args`, `transport` (`stdio` default or `socket`; every server actually runs over stdio), `env`, `initializationOptions`, `settings`, `workspaceFolder`, `startupTimeout`, `shutdownTimeout`, `restartOnCrash` (default `true`), `maxRestarts`, `diagnostics` (default `true`; docs only).
- **Monitor entry**: `name`, `command`, `description` (all required), `when` (`"always"` default, or a string matching `^on-skill-invoke:.*`).
- **Inline MCP server** (schema): `stdio` with `command` required and optional `type`, `args`, `env`; `sse` and `http` with `type` and `url` required plus `headers`, `headersHelper`, `oauth`; `ws` with `type` and `url` required plus `headers`, `headersHelper`.

## Component paths

Every component path is relative to the plugin root and must start with `./`; `commands/foo.md` fails validation. Exceptions: `skills` also accepts `"."` (failed validation before v2.1.221, so use `"./"` for older versions), and `mcpServers` also accepts an `https://` bundle URL.[^cc-plugins-reference] The schema encodes the prefix as pattern `^\.\/.*`, plus `.*\.md$` for agent files and `.*\.json$` for hooks, MCP, LSP and monitor files.[^cc-plugin-schema]

Every component path must resolve inside the plugin root and must exist. Escapes show `<component> path escapes plugin directory: <path>` (validate: `Path contains ".." which could be a path traversal attempt`); missing paths show `<component> path not found: <path>` (validate: `Path not found`).[^cc-plugins-reference] On macOS and Linux a component path containing a backslash anywhere is rejected, so use forward slashes.[^cc-plugins-loading]

How each key combines with its default location:[^cc-plugins-reference]

- **Replaces the default**: `commands`, `agents`, `outputStyles`, `workflows`, `experimental.themes`, `experimental.monitors`. To keep the default, list it: `"commands": ["./commands/", "./extras/"]`. A plugin that has the default folder and also sets the key gets the warning `Default <folder>/ folder is ignored because the manifest sets "<key>"`, unless the key names a path inside that folder.
- **Adds to the default**: `skills`. `skills/` is still scanned.
- **Merges**: `hooks`, `mcpServers`, `lspServers`. The default file loads first, then the manifest's declarations.

Marketplace entries can also carry component fields. With no `plugin.json`, the entry is the manifest (entry `hooks` only in inline-object form). With `plugin.json` and `strict` unset or `true`, entry `commands`, `agents`, `skills`, `outputStyles` and `themes` append, and entry hook matchers replace the manifest's for the same event. With `strict: false`, any of those keys in the entry is a conflict and the plugin fails to load with `Plugin <name> has conflicting manifests`. The manifest's `version` overrides the entry's; the entry's `defaultEnabled` and display fields override the manifest's.[^cc-plugins-reference]

## Environment variables

| Variable | Resolves to |
| :- | :- |
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path of the plugin's installed version. Changes on every update, so don't write state there |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/<id>/`, created on first reference, kept across updates, deleted on uninstall from the last place it's installed. `<id>` is the plugin identifier with every character other than a letter, digit, `_` or `-` replaced by `-` |
| `${CLAUDE_PROJECT_DIR}` | The project root |

Where `${...}` resolves and what is exported:[^cc-plugins-reference]

| Component | Fields where `${...}` resolves | Exported to the process |
| :- | :- | :- |
| Hook commands | `command` and `args` | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_OPTION_<KEY>` |
| Monitor commands | `command` | Not exported |
| MCP `stdio` servers | `command`, `args`, `env` | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` |
| MCP `http`, `sse`, `ws` servers | `url`, `headers`, `headersHelper` | Not applicable |
| LSP servers | `command`, `args`, `env`, `workspaceFolder` | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR` |
| Skill, command and agent content | Anywhere in the Markdown body | Not applicable |

The variables are not in the environment of commands Claude runs through the Bash tool; write the `${...}` reference into skill, command or agent Markdown and Claude Code substitutes it on load. In shell-form hooks and monitor commands, wrap the variable in double quotes (`"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/x.sh"`); validate warns about an unquoted one unless the hook sets `shell` to `"powershell"`. Substituted paths use forward slashes on Windows.[^cc-plugins-reference] The plugins root is `~/.claude/plugins` unless `CLAUDE_CODE_PLUGIN_CACHE_DIR` is set.[^cc-plugins-loading]

## Hooks

`hooks/hooks.json` wraps the event map in a top-level `"hooks"` key, the same shape as `hooks` in `settings.json`. A hooks file without that wrapper fails to load; an inline `hooks` object in the manifest is the bare event map.[^cc-plugins-reference] The same `hooks/hooks.json` can list JavaScript mod modules under a `modules` key.[^cc-plugins-components]

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/format.sh" }
        ]
      }
    ]
  }
}
```

Each event maps to an array of matcher groups: `matcher` (string, optional) and `hooks` (array, required).[^cc-plugin-schema] Handler types, with schema-required keys:[^cc-plugin-schema][^cc-hooks]

- `command`: `type`, `command`; optional `if`, `shell` (`bash` or `powershell`), `timeout` (seconds, > 0), `statusMessage`, `once`, `async`, `asyncRewake`. The docs add `args`: when present the hook runs in exec form, spawning `command` directly with no shell.
- `http`: `type`, `url`; optional `headers`, `allowedEnvVars`, `if`, `timeout`, `statusMessage`, `once`.
- `mcp_tool`: `type`, `server`, `tool`; optional `input`, `if`, `timeout`, `statusMessage`, `once`.
- `prompt`: `type`, `prompt`; optional `model`, `if`, `timeout`, `statusMessage`, `once`.
- `agent`: `type`, `prompt`; optional `model`, `if`, `timeout`, `statusMessage`, `once`.

Hook events in the hooks reference: `SessionStart`, `Setup`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Notification`, `MessageDisplay`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Stop`, `StopFailure`, `TeammateIdle`, `InstructionsLoaded`, `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `PreModelSwitch`, `PostModelSwitch`, `Elicitation`, `ElicitationResult`, `SessionEnd`.[^cc-hooks] The schema's event-name enum has 29 of these, without `MessageDisplay`, `DirectoryAdded`, `PreModelSwitch` and `PostModelSwitch`.[^cc-plugin-schema]

### Hook input and output contract

A command hook receives the event's JSON on stdin and answers with an exit code, stdout and stderr. HTTP hooks get the same JSON as the POST body. Command hooks run in their own session with no controlling terminal, so a script cannot write to `/dev/tty`.[^cc-hooks]

**Corrections to the handler list above.** `once` is honoured only for hooks declared in skill frontmatter and is ignored in settings files, agent frontmatter and so in a plugin's `hooks/hooks.json`. A plugin's `hooks/hooks.json` may carry a top-level `description` beside `hooks`. The docs prefer exec form (`args` present, no shell) for any hook that uses a path placeholder, because each `args` element is one argument with no quoting; shell form needs the placeholder wrapped in double quotes.[^cc-hooks]

#### Common stdin fields

Every event receives these, plus its own fields below.[^cc-hooks]

| Field | Meaning |
| :- | :- |
| `session_id` | Current session identifier |
| `transcript_path` | Path to the conversation JSON. Written asynchronously, so it can lag the turn; use `last_assistant_message` on `Stop` and `SubagentStop` instead |
| `cwd` | Working directory when the hook fires. Follows Claude into a worktree or after a `cd`, while `CLAUDE_PROJECT_DIR` stays at the session's start |
| `hook_event_name` | The event that fired |
| `permission_mode` | `default`, `plan`, `acceptEdits`, `auto`, `dontAsk` or `bypassPermissions`. Not every event carries it (`SessionStart`, `SessionEnd`, `Notification`, `SubagentStart` and `PreCompact` examples omit it) |
| `prompt_id` | UUID of the user prompt being processed. Absent until the first user input |
| `agent_id`, `agent_type` | Present when the hook fires inside a subagent, or `agent_type` alone under `--agent` |

Also documented and optional: `effort` (an object with `level`, on tool-context events), and `scratchpad_dir`.[^cc-hooks]

#### Per-event stdin fields

Fields beyond the common ones, for the events pluginfinity's hook library supports:[^cc-hooks]

| Event | Fields |
| :- | :- |
| `SessionStart` | `source` (`startup`, `resume`, `clear`, `compact`, `fork`); optional `model`, `agent_type`, `session_title`; on `resume` and `fork` also `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired`, `estimated_cache_write_usd` |
| `SessionEnd` | `reason` (`clear`, `resume`, `logout`, `prompt_input_exit`, `other`) |
| `UserPromptSubmit` | `prompt`; optional `session_title` |
| `PreToolUse` | `tool_name`, `tool_input`, `tool_use_id`; for MCP tools also `mcp_server` |
| `PostToolUse` | `tool_name`, `tool_input`, `tool_response` (the tool's structured output), `tool_use_id`; optional `duration_ms` |
| `PostToolUseFailure` | `tool_name`, `tool_input`, `tool_use_id`, `error`; optional `is_interrupt`, `duration_ms` |
| `Stop` | `stop_hook_active`, `last_assistant_message`, `background_tasks`, `session_crons` |
| `SubagentStart` | `agent_id`, `agent_type` |
| `SubagentStop` | `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`, `background_tasks`, `session_crons` |
| `PreCompact` | `trigger` (`manual` or `auto`), `custom_instructions` (`null` unless `manual` with text) |
| `Notification` | `message`, `notification_type`; optional `title` |
| `PermissionRequest` | `tool_name`, `tool_input`; optional `permission_suggestions`; no `tool_use_id` |

`stop_hook_active` is `true` when Claude is already continuing because of a stop hook. After eight consecutive continuations Claude Code overrides the next block and ends the turn (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` raises it).[^cc-hooks]

#### Exit codes

| Code | Effect |
| :- | :- |
| `0` | Success. stdout is parsed as JSON when it starts with `{` and ends with `}`; otherwise it is plain text. Plain text becomes context only on `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart` and `PostModelSwitch` |
| `2` | A blocking error on the events that can block (see the table below). It wins over any JSON, even `permissionDecision: "allow"`. stderr is the reason unless the JSON gives one |
| other | Non-blocking: the action proceeds and the transcript shows a hook-error notice with the first stderr line. Exit `1` does not block |

Exceptions to the exit-2 rule:[^cc-hooks]

- `PermissionRequest` does not honour exit 2: the permission flow proceeds unchanged and stderr is discarded. Deny through the `decision` object.
- `WorktreeCreate` and `WorktreeRemove` fail on any non-zero exit. A `WorktreeCreate` command hook prints the worktree path on stdout and cannot return JSON.
- `PostToolUse` and `PostToolUseFailure` show stderr to Claude on exit 2, but the tool already ran.
- `SessionStart`, `SubagentStart`, `SessionEnd` and `PostModelSwitch` show stderr to the user only. `Notification` ignores code and stderr.
- A script that cannot start (path missing, not executable) exits with a code like 127 and so is a non-blocking error: a policy gate silently stays open.

Events where exit 2 blocks: `PreToolUse`, `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `SubagentStop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `ConfigChange` (not `policy_settings`), `PostToolBatch`, `PreCompact`, `PreModelSwitch`, `Elicitation`, `ElicitationResult`, `WorktreeCreate`, `WorktreeRemove`.[^cc-hooks]

**Timeouts.** A `command`, `http` or `mcp_tool` hook that reaches its timeout is cancelled and its output discarded, so on most events it renders no decision. A timed-out `PreToolUse` command hook does not block the call. A timed-out `PreModelSwitch` hook does block the switch.[^cc-hooks]

#### Universal JSON fields

Every event accepts these on stdout JSON; some events discard them, and each event section says which.[^cc-hooks]

| Field | Effect |
| :- | :- |
| `continue` | Default `true`. `false` stops Claude entirely and beats any event-specific decision |
| `stopReason` | Shown to the user when `continue` is `false` |
| `systemMessage` | Warning shown to the user. Discarded by `Notification`, `SessionEnd`, `PreCompact` and `ConfigChange` |
| `terminalSequence` | An escape sequence Claude Code writes for you, restricted to OSC `0`/`1`/`2`/`9`/`99`/`777` and BEL, in interactive sessions only. Anything else is ignored, so the whole field is dropped |
| `suppressOutput` | Accepted and has no effect |

An invalid object on any exit code but 2 is a non-blocking error; a parse failure on a standard-decision event is too. A hook's `additionalContext`, `systemMessage` and `initialUserMessage` strings, and plain stdout, are each capped at 10,000 characters: over the cap Claude Code saves the text to a file and passes a path and a preview of up to 2,000 characters instead.[^cc-hooks]

#### Decision control by event

| Events | Pattern | Fields |
| :- | :- | :- |
| `UserPromptSubmit`, `UserPromptExpansion`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SubagentStop`, `ConfigChange`, `PreCompact` | Top-level `decision` | `decision: "block"` (the only value) and `reason`. Omit `decision` to allow |
| `TaskCreated` | Exit 2 or top-level `decision` | `decision: "block"` deletes the task; `continue: false` is ignored |
| `PreModelSwitch` | `hookSpecificOutput` or top-level `decision` | `permissionDecision` of `allow`, `deny` or `ask`; `decision: "block"` also cancels. No `updatedInput`, `additionalContext` or `defer` |
| `PreToolUse` | `hookSpecificOutput` | `permissionDecision` of `allow`, `deny`, `ask` or `defer`; `permissionDecisionReason`; `updatedInput`; `additionalContext` |
| `PermissionRequest` | `hookSpecificOutput` | `decision.behavior` of `allow` or `deny`; `updatedInput`, `updatedPermissions` (allow); `message`, `interrupt` (deny) |
| `SessionStart`, `SubagentStart`, `PostModelSwitch` | Context only | `hookSpecificOutput.additionalContext`. No blocking |
| `Setup`, `Notification`, `SessionEnd`, `PostCompact`, `InstructionsLoaded`, `StopFailure`, `CwdChanged`, `DirectoryAdded`, `FileChanged` | None | Side effects only |

Context via `hookSpecificOutput.additionalContext` (with `hookEventName` set to the event name) is accepted on `SessionStart`, `SubagentStart`, `PostModelSwitch`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop` and `SubagentStop`. On `Stop` and `SubagentStop` it keeps the conversation going as non-error feedback, with the same `stop_hook_active` and eight-continuation protections as `decision: "block"`. `PreCompact` and `Notification` take no context.[^cc-hooks]

Details that matter when writing a script:[^cc-hooks]

- `PreToolUse` top-level `decision` and `reason` are deprecated; `approve` and `block` map to `allow` and `deny`. When several hooks disagree, `deny` beats `defer`, which beats `ask`, which beats `allow`.
- `defer` works only in non-interactive `-p` runs with a single tool call in the turn; interactive sessions log a warning and ignore it. `updatedInput` replaces the whole input object.
- `PostToolUse` can also return `updatedToolOutput` (it must match the tool's output shape) and `classifierContext`. Its `decision: "block"` only adds `reason` beside the result.
- `UserPromptSubmit` cannot replace the prompt. `reason` on a block is shown to the user, not added to context.
- `PostToolUseFailure` appears in the top-level decision row of the quick-reference table, but its own section documents only `additionalContext`; treat it as context-only.
- `PreCompact` blocks with exit 2 or `decision: "block"`, and discards `systemMessage` and `continue`.

#### Matchers

A matcher of `*`, `""` or omitted matches all. A matcher of only letters, digits, `_`, `-`, spaces, `,` and `|` is an exact string or a list of them. Anything else is an unanchored JavaScript regular expression, so `Edit.*` also matches `NotebookEdit`; anchor with `^` and `$`. `FileChanged` and `StopFailure` use a narrower exact set and treat `-`, space and `,` as regex characters.[^cc-hooks] Each event matches its own field: tool name for `PreToolUse`, `PostToolUse`, `PostToolUseFailure` and `PermissionRequest`; `source` for `SessionStart`; `reason` for `SessionEnd`; `notification_type` for `Notification`; agent type for `SubagentStart` and `SubagentStop`; `trigger` for `PreCompact`; the target model name for the model-switch events. `UserPromptSubmit`, `PostToolBatch`, `Stop` and `TaskCreated` have no matcher, and one written there is silently ignored. A plugin-scoped agent name such as `my-plugin:reviewer` contains a colon and so takes the regex path.[^cc-hooks]

#### Timeouts and size limits

The default `timeout` for `command`, `http` and `mcp_tool` hooks is 600 seconds, 30 on `UserPromptSubmit`, `PreModelSwitch` and `PostModelSwitch`, and 10 on `MessageDisplay`; `prompt` hooks default to 30 and `agent` hooks to 60. `SessionEnd` hooks share a 1.5-second budget, raised by a longer per-hook `timeout` up to 60 seconds, but not by a plugin-provided hook's `timeout`. `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` overrides the budget. The 10,000-character cap above has no setting to raise it.[^cc-hooks]

#### Environment variables

| Variable | Where it is set |
| :- | :- |
| `CLAUDE_PROJECT_DIR` | Command hooks; the project root where the session started. Also stdio MCP and LSP servers |
| `CLAUDE_PLUGIN_ROOT` | Command hooks of a plugin; the install directory, which changes across updates |
| `CLAUDE_PLUGIN_DATA` | Command hooks of a plugin; a persistent directory that survives updates |
| `CLAUDE_PLUGIN_OPTION_<KEY>` | Plugin hooks, one per user-config option; the way to read an option from a shell-form hook |
| `CLAUDE_ENV_FILE` | `SessionStart`, `Setup`, `CwdChanged` and `FileChanged` hooks only; append `export` lines to carry variables into later Bash commands |
| `CLAUDE_EFFORT` | Hook commands and the Bash tool; the effort level |

Both exec and shell form export the first three to the spawned process. A hook inherits the parent environment apart from `OTEL_*` exporter variables. `CLAUDE_CODE_REMOTE` is `"true"` in remote web sessions.[^cc-hooks]

## Installation behaviour relevant to a build

- **In place versus copied.** `--plugin-dir` and skills-directory plugins (`~/.claude/skills/<name>/` or `<project>/.claude/skills/<name>/` with a `.claude-plugin/plugin.json`) load in place and are never copied; a `--plugin-dir` `.zip` or `--plugin-url` archive is extracted to a session temp directory. Relative-path plugins in a marketplace added from a local directory load in place. Every other marketplace plugin is copied into `cache/<marketplace>/<plugin>/<version>/` at install, and `${CLAUDE_PLUGIN_ROOT}` points there.[^cc-plugins-loading]
- **Nothing outside the root.** Files outside the plugin directory aren't copied, so a script reading `../shared` finds nothing. Component paths that resolve outside the root, as written or through a symlink, are rejected whether the plugin is copied or not.[^cc-plugins-loading]
- **Symlinks on copy.** A symlink resolving within the plugin is preserved as a relative symlink; one resolving elsewhere in the same marketplace is dereferenced (target content copied in); one resolving outside the marketplace is skipped. For plugins installed from a local path, or a `command` source in the default `copy` mode, only symlinks within the plugin are preserved and all others are skipped.[^cc-host-marketplace]
- **Versions.** The computed version names the cache directory and decides whether an update replaces the cached copy. Order: manifest `version`, then marketplace entry `version`, then the source (12-character commit SHA for `github`, `url`, `git-subdir`; 12-character SHA-256 for `archive`; `unknown` for `npm` and for non-git local directories). A pinned `version` keeps users on the cached copy however many commits are pushed.[^cc-plugins-loading]
- **Node dependencies.** On copy, Claude Code installs `package.json` dependencies into the version directory only when the root also has a supported lockfile: `bun.lock` (lockfileVersion no higher than 2), `npm-shrinkwrap.json` or `package-lock.json` (lockfileVersion 2 or 3), checked in that order. `bun.lockb`, `yarn.lock` and `pnpm-lock.yaml` get no install. Every dependency must be a registry package pinned to an exact version; a git, folder, workspace or linked dependency gets no install. The install is frozen, runs in a separate folder that ignores the plugin's `.npmrc`, `.env` and `bunfig.toml`, and is skipped when `package.json` and the lockfile list different dependencies. For an npm-sourced plugin use `npm-shrinkwrap.json`, since npm excludes `package-lock.json` from published packages. In-place plugins get no install.[^cc-plugins-loading]
- **Old versions.** On update or uninstall the previous version directory gets an `.orphaned_at` marker and is removed 14 days later. Mid-session updates keep hooks, MCP and LSP servers on the old path until `/reload-plugins`; monitors need a restart.[^cc-plugins-loading]
- **Project-scope plugins.** These need workspace trust. MCP servers declared as `.mcpb`/`.dxt` bundles or from a file outside the plugin directory are skipped, and monitors don't load.[^cc-plugins-loading]
- **Folder of plugins.** `--plugin-dir` on a folder with no `.claude-plugin/` and no top-level components loads each immediate subfolder that has `.claude-plugin/plugin.json` (v2.1.265+). Pointed at a marketplace root, it doesn't read `marketplace.json`.[^cc-plugins-create]
- **Validation.** `claude plugin validate <dir>` is the authoritative check; `--strict` turns warnings into failures.[^cc-plugins-reference]

## Docs vs schema discrepancies

Against the SchemaStore schema generated 2026-04-23:[^cc-plugin-schema][^cc-plugins-reference][^cc-hooks]

- **Fields missing from the schema**: `displayName`, `metadata`, `icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`, `defaultEnabled`, `types`, `workflows`, `experimental` (and its `themes`, `monitors`, `evals`). The schema sets no `additionalProperties: false` at top level, so they still validate.
- **`themes` and `monitors` placement**: the schema has them top-level; the docs place them under `experimental` and treat top-level as deprecated (loads with a warning).
- **Replace versus add**: schema descriptions for `commands`, `agents`, `outputStyles` and `themes` say "in addition to" the default directory; the docs say these keys replace the default scan. Only `skills` adds.
- **`skills: "."`**: the docs accept it; the schema's `^\.\/.*` pattern rejects it (`"./"` passes both).
- **`version`**: the schema description says semver; the docs say it isn't checked against semver.
- **`dependencies` object**: the docs list `version`; the schema declares only `name` and `marketplace` (extra keys allowed). The schema string form allows an `@^...` version suffix.
- **MCP bundle paths**: the docs require a `.mcpb` or `.dxt` extension; the schema only requires the `./` prefix (or a `uri`).
- **LSP `diagnostics`**: in the docs, absent from the schema, whose LSP config is `additionalProperties: false`.
- **Command hook `args`** (exec form): in the docs, absent from the schema.
- **Hook events**: `MessageDisplay`, `DirectoryAdded`, `PreModelSwitch` and `PostModelSwitch` are in the docs but not the schema enum.
- **Manifest reference URL**: the tutorial links to `/docs/en/plugins/manifest-reference`, and the schema description links to `https://code.claude.com/docs/en/plugins-reference`; the `.md` form of the latter serves the "Plugin manifest reference" page.[^cc-plugins-create]

[^cc-plugins-create]: <https://code.claude.com/docs/en/plugins/create.md>
[^cc-plugins-reference]: <https://code.claude.com/docs/en/plugins-reference.md>
[^cc-plugin-schema]: <https://www.schemastore.org/claude-code-plugin-manifest.json>
[^cc-plugins-components]: <https://code.claude.com/docs/en/plugins/components.md>
[^cc-plugins-loading]: <https://code.claude.com/docs/en/plugins/loading.md>
[^cc-hooks]: <https://code.claude.com/docs/en/hooks.md>
[^cc-host-marketplace]: <https://code.claude.com/docs/en/plugins/host-marketplace.md>
