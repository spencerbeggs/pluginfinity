---
type: Reference
title: GitHub Copilot CLI plugin format
description: "Layout, manifest fields, component discovery, hooks, marketplace and install behaviour of GitHub Copilot CLI plugins, in both the Agent Plugins 1.0 and legacy formats."
status: draft
tags:
  - portability
  - github
stale_after: 2027-01-01T00:00:00Z
sources:
  - id: copilot-cli-plugin-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
    title: GitHub Copilot CLI plugin reference
    last_modified: 2026-10-03T00:00:00Z
  - id: copilot-cli-plugins-creating
    resource: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating
    title: Creating a plugin for GitHub Copilot CLI
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-cli-plugins-marketplace
    resource: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace
    title: Creating a plugin marketplace for GitHub Copilot CLI
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-about-plugins
    resource: https://docs.github.com/en/copilot/concepts/agents/about-plugins
    title: About GitHub Copilot plugins
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-hooks-reference
    resource: https://docs.github.com/en/copilot/reference/hooks-configuration
    title: GitHub Copilot hooks reference
    last_modified: 2026-10-03T00:00:00Z
  - id: copilot-use-hooks
    resource: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
    title: Using hooks with GitHub Copilot CLI
    last_modified: 2026-10-03T00:00:00Z
  - id: copilot-cli-command-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
    title: GitHub Copilot CLI command reference
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-cli-config-dir-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference
    title: GitHub Copilot CLI configuration directory
    last_modified: 2026-10-02T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-03T19:33:34Z
  body_sha256: f979630ad881111f106f8fb3612e6fd779765a2f6a0c1677f546296fe3113b4e
---

# GitHub Copilot CLI plugin format

A Copilot CLI plugin is a directory with a `plugin.json` manifest plus any combination of agents, skills, hooks, MCP server and LSP server configurations.[^copilot-about-plugins] Copilot CLI supports two plugin formats, selected by the manifest's `$schema`:[^copilot-cli-plugin-reference]

- **Agent Plugins 1.0** (the Open Plugin Spec). Opted into by setting `$schema` to exactly `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` or `https://agent-plugins.org/schemas/1.1.0/plugin.schema.json`. Skills and MCP servers are portable; Copilot-specific components live under `com.github.copilot/`. Component locations are fixed.
- **Legacy Copilot format.** Any manifest without one of those exact `$schema` values. Supports configurable component paths in the manifest.

If a manifest declares an Agent Plugins version the CLI does not support, the plugin is rejected rather than falling back to legacy mode, and contributes no hooks, LSP servers, MCP servers, skills, commands, agents, rules, or extension directories.[^copilot-cli-plugin-reference] GitHub recommends Agent Plugins 1.0 for new plugins unless configurable component paths are needed.[^copilot-about-plugins]

## Layout

Agent Plugins 1.0 layout:[^copilot-about-plugins]

```text
my-plugin/
├── plugin.json               # Required manifest
├── skills/                   # Skills (optional)
│   └── deploy/
│       └── SKILL.md
├── mcp.json                  # MCP server config (optional)
└── com.github.copilot/       # Copilot components (optional)
    ├── agents/
    │   └── helper.agent.md
    ├── commands/
    ├── rules/
    ├── hooks/
    │   └── hooks.json
    └── lsp.json
```

Legacy layout:[^copilot-about-plugins]

```text
my-plugin/
├── plugin.json           # Required manifest
├── agents/               # Custom agents (optional)
│   └── helper.agent.md
├── skills/               # Skills (optional)
│   └── deploy/
│       └── SKILL.md
├── hooks.json            # Hook configuration (optional)
├── .mcp.json             # MCP server config (optional)
└── lsp.json              # LSP server config (optional)
```

Manifest location:[^copilot-cli-plugin-reference]

- Agent Plugins 1.0 requires `plugin.json` at the plugin root. A root manifest targeting Agent Plugins takes precedence over `.plugin/plugin.json` and `.claude-plugin/plugin.json` (spec §5.1).
- Legacy plugins: `.plugin/plugin.json`, `plugin.json`, `.github/plugin/plugin.json`, or `.claude-plugin/plugin.json`, checked in this order.

File locations summary:[^copilot-cli-plugin-reference]

| Item | Agent Plugins 1.0 | Legacy |
| --- | --- | --- |
| Manifest | `plugin.json` | `.plugin/plugin.json`, `plugin.json`, `.github/plugin/plugin.json`, `.claude-plugin/plugin.json` (in order) |
| Agents | `com.github.copilot/agents/` | `agents/` (default, overridable) |
| Skills | `skills/` (fixed, no root `SKILL.md` fallback) | `skills/` (default, overridable), falling back to a root `SKILL.md` when no `skills/` exists |
| Commands | `com.github.copilot/commands/` | `commands` manifest field (no default listed) |
| Rules | `com.github.copilot/rules/` | not listed |
| Hooks | `com.github.copilot/hooks/hooks.json` | `hooks.json` or `hooks/hooks.json` |
| MCP | `mcp.json` | `.mcp.json`, `.github/mcp.json`, or `mcpServers` manifest field |
| LSP | `com.github.copilot/lsp.json` | `lsp.json` or `.github/lsp.json`; the reference also describes `lsp-config/servers.json` |

## Manifest fields

### Agent Plugins 1.0

A closed schema; unknown top-level fields are reported and ignored. Component path fields (`agents`, `skills`, `hooks`, `mcpServers`, `lspServers`) are not Agent Plugins 1.0 fields.[^copilot-cli-plugin-reference]

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `$schema` | string | Yes | Recognized Agent Plugins schema URL (v1.0.0 or v1.1.0). Unsupported versions are rejected. |
| `name` | string | Yes | 1-64 chars; lowercase ASCII letters, digits, hyphens, periods; starts and ends alphanumeric; no `--` or `..`. |
| `version` | string | No | SemVer recommended. |
| `description` | string | No | Brief description. |
| `author` | object | No | Optional `name`, `email`, `url` strings. |
| `homepage` | string | No | Homepage or documentation. |
| `repository` | string | No | Source repository. |
| `license` | string | No | SPDX identifier recommended. |
| `keywords` | string[] | No | Discovery keywords. |
| `extensions` | object | No | Client-specific data keyed by reverse-domain namespace. |

Client-specific files go in a top-level directory named for the same namespace; clients ignore namespaces they do not support. Copilot's namespace is `com.github.copilot`.[^copilot-cli-plugin-reference]

### Legacy

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `name` | string | Yes | — | Kebab-case (letters, numbers, hyphens). Max 64 chars. |
| `description` | string | No | — | Max 1024 chars. |
| `version` | string | No | — | Semantic version. |
| `author` | object | No | — | `name` (required), `email`, `url` (optional). |
| `homepage` | string | No | — | Homepage URL. |
| `repository` | string | No | — | Source repository URL. |
| `license` | string | No | — | License identifier. |
| `keywords` | string[] | No | — | Search keywords. |
| `category` | string | No | — | Plugin category. |
| `tags` | string[] | No | — | Additional tags. |
| `agents` | string or string[] | No | `agents/` | Agent directories (`.agent.md` files). |
| `skills` | string or string[] | No | `skills/` | Skill directories (`SKILL.md` files). |
| `commands` | string or string[] | No | — | Command directories. |
| `hooks` | string or object | No | — | Path to a hooks config file, or an inline hooks object. |
| `extensions` | string, string[] or object | No | — | Extension directories. `{ paths: [...], exclusive: true }` suppresses built-in extensions. Different meaning from the Agent Plugins `extensions`. |
| `mcpServers` | string or object | No | — | Path to an MCP config file (for example `.mcp.json`), or inline server definitions. |
| `lspServers` | string or object | No | — | Path to an LSP config file, or inline server definitions. |

Source: [^copilot-cli-plugin-reference]. Example legacy manifest using path fields:[^copilot-cli-plugins-creating]

```json
{
  "name": "my-dev-tools",
  "description": "React development utilities",
  "agents": "agents/",
  "skills": ["skills/", "extra-skills/"],
  "hooks": "hooks.json",
  "mcpServers": ".mcp.json"
}
```

## Components

**Agents.** Files named `NAME.agent.md`, in `agents/` (legacy) or `com.github.copilot/agents/` (Agent Plugins 1.0).[^copilot-cli-plugins-creating] For plugin agents, the ID is derived from the file name (`reviewer.agent.md` → `reviewer`) and is the deduplication key; first-found wins, and plugin agents rank below user (`~/.copilot/agents/`), project (`.github/agents/`, `.claude/agents/`) and `--add-dir` agents, above remote org/enterprise agents.[^copilot-cli-plugin-reference] For user, project and added-root agents the CLI strips `.agent.md` or `.md` and joins subdirectories with `--` (`agents/team/reviewer.agent.md` → `team--reviewer`).[^copilot-cli-command-reference] Frontmatter is documented in the command reference under "Custom agent frontmatter fields". A plugin-shipped agent can declare its own `mcp-servers` in frontmatter; inside that block `${PLUGIN_ROOT}` (and the aliases `${CLAUDE_PLUGIN_ROOT}`, `${COPILOT_PLUGIN_ROOT}`) expands to the plugin root. That substitution does not cover `${PLUGIN_DATA}` or the server's environment variables.[^copilot-cli-plugin-reference]

**Skills.** Immediate subdirectories of `skills/`, each containing `SKILL.md` (`skills/deploy/SKILL.md`).[^copilot-cli-plugins-creating] Deduplicated by the `name` field in `SKILL.md`, first-found wins; plugin skills rank below project and personal skills and above `COPILOT_SKILLS_DIRS`.[^copilot-cli-plugin-reference] When two plugins provide skills with the same name, both coexist under plugin-qualified invocation names such as `/my-plugin/search`; the bare name routes to the higher-priority plugin. Skill `name` may contain colons for namespacing (for example `my-plugin:search`). Frontmatter is documented in the command reference under "Skill frontmatter fields".[^copilot-cli-command-reference]

**Commands.** Described in the command reference as an alternative skill format: individual `.md` files (the name comes from the filename, no `name` field required) supporting `argument-hint`, `description`, `allowed-tools`, `disable-model-invocation`; lower priority than skills of the same name, with tier-based deduplication.[^copilot-cli-command-reference] Plugin commands come from the `commands` manifest field (legacy) or `com.github.copilot/commands/` (Agent Plugins 1.0).[^copilot-cli-plugin-reference]

**MCP servers.** Agent Plugins 1.0: root `mcp.json`, which must carry an Agent Plugins `$schema` matching the `plugin.json` version (for example `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`), with a closed envelope and a `mcpServers` map. Each entry is validated against its transport schema; invalid entries are skipped individually. Accepted transports: `stdio`, `streamable-http`, `sse`.[^copilot-cli-plugin-reference] Legacy: `.mcp.json`, `.github/mcp.json`, or the `mcpServers` field. MCP servers are last-wins by server name; a plugin server overrides a same-named server in `~/.copilot/mcp-config.json`, `--additional-mcp-config` overrides plugins, and between plugins the last loaded wins with a warning naming every earlier definer.[^copilot-cli-plugin-reference]

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "deployment-api": {
      "type": "streamable-http",
      "url": "https://deploy.example.com/mcp"
    },
    "local-validator": {
      "type": "stdio",
      "command": "node",
      "args": ["${PLUGIN_ROOT}/server/index.js"],
      "cwd": "${PLUGIN_ROOT}",
      "env": {
        "DATA_DIR": "${PLUGIN_DATA}/validator"
      }
    }
  }
}
```

Example from [^copilot-cli-plugins-creating].

**LSP servers.** Configured under a top-level `lspServers` map, keyed by server name.[^copilot-cli-plugin-reference]

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `command` | string | one of `command`, `bash`, `powershell` | Executable. |
| `bash` | string | one of the three | Run via `bash -c SCRIPT` (Linux/macOS). |
| `powershell` | string | one of the three | Run via `pwsh -c SCRIPT` (Windows). |
| `cwd` | string | No | Absolute or relative to the config file. Supports `${PLUGIN_ROOT}`. |
| `args` | string[] | No | Ignored for `bash` and `powershell`. |
| `env` | object | No | Environment variables. |
| `fileExtensions` | object | Yes | Extension → language ID map, for example `{ ".ts": "typescript" }`. |
| `rootUri` | string | No | Project root relative to the git root (default `.`). |
| `initializationOptions` | any | No | Sent in the LSP `initialize` request. |

**Rules.** Agent Plugins 1.0 only lists `com.github.copilot/rules/`; no legacy location is documented.[^copilot-cli-plugin-reference]

**Precedence.** Built-in tools and agents cannot be overridden. Agents and skills are first-found-wins, so a plugin cannot override a project-level or personal agent or skill of the same name or ID; it is silently ignored.[^copilot-cli-plugin-reference]

## Environment variables

From the plugin reference:[^copilot-cli-plugin-reference]

| Variable | Where | Meaning |
| --- | --- | --- |
| `PLUGIN_ROOT` | Set in the env of Agent Plugins 1.0 `stdio` MCP servers; `${PLUGIN_ROOT}` expanded in their `args`, `env` values and `cwd` | Plugin root directory. |
| `PLUGIN_DATA` | Same as above; aliases `${CLAUDE_PLUGIN_DATA}` and `${COPILOT_PLUGIN_DATA}` | Persistent, writable directory unique to each installed plugin. |
| `${PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_ROOT}`, `${COPILOT_PLUGIN_ROOT}` | Expanded in a plugin-shipped agent's frontmatter `mcp-servers` block only | Plugin root directory. |
| `${PLUGIN_ROOT}` | LSP `cwd` and the `bash`/`powershell` launch strings in examples | Plugin root directory. |

Remote `http`, `sse` and `streamable-http` MCP server values are passed through literally with no placeholder or environment-variable expansion.[^copilot-cli-plugin-reference] Plugin data lives under `~/.copilot/plugin-data/`, organized by marketplace and plugin name.[^copilot-cli-config-dir-reference]

For hooks, the hooks reference documents that when the session sandbox is enabled a plugin hook can read the directory it was loaded from and write to its data directory `$COPILOT_PLUGIN_DATA`; the hook `env` field "supports variable expansion".[^copilot-hooks-reference] None of the fetched pages documents a plugin-root variable for hook commands.

## Hooks

Plugin hooks are declared in the plugin's `hooks.json` (or `hooks/hooks.json`; `com.github.copilot/hooks/hooks.json` for Agent Plugins 1.0), or inline via the legacy `hooks` manifest field. Hooks load in the order policy, user, project, plugins and are combined; when the same event appears in several sources, every entry runs.[^copilot-hooks-reference] The sources are:[^copilot-hooks-reference]

- **Policy hooks** (CLI only): `*.json` files in `/etc/github-copilot/policy.d/` on Linux and macOS or `C:\ProgramData\GitHub\Copilot\policy.d\` on Windows, loaded alphabetically, plus Windows Registry values under `HKLM\Software\Policies\GitHub\Copilot`. On POSIX they must be root-owned and not group- or world-writable. They load first, cannot be disabled by `disableAllHooks`, and always run on the host outside the session sandbox.
- **Repository hook files**: `.github/hooks/*.json`. This is the only hook source a cloud agent job has.
- **User hook files**: `~/.copilot/hooks/*.json`, or `$COPILOT_HOME/hooks/` when set.
- **Inline `hooks` blocks**: in `.github/copilot/settings.json` and `settings.local.json`, the cross-tool `.claude/settings.json` and `settings.local.json`, and `~/.copilot/settings.json`. Inline blocks are strict: one invalid item rejects the whole field, where a malformed item in a hook file is dropped alone.
- **Plugin hooks**: each plugin's own `hooks.json`.

**Cloud agent restrictions.** A cloud agent job runs in an ephemeral, non-interactive Linux sandbox that does not ship installed plugins, user hook files or `settings.json`, so plugin hooks are a CLI concern. There only `bash` (or the `command` fallback) entries are honoured, `exec` and `powershell` are not, the filesystem is discarded at job end, and the firewall blocks hosts other than GitHub and Copilot unless an admin allows them. `notification` and `permissionRequest` do not fire; `preCompact` fires only with `trigger: "auto"`; `preToolUse` treats `ask` as `deny`; `userPromptSubmitted` fires at most once.[^copilot-hooks-reference]

File format: JSON with `version: 1`, optional `disableAllHooks`, and a `hooks` object mapping event name → array of entries.[^copilot-hooks-reference]

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "bash": "./scripts/check.sh",
        "powershell": "./scripts/check.ps1",
        "cwd": "OPTIONAL/WORKING/DIRECTORY",
        "env": { "VAR": "VALUE" },
        "timeoutSec": 30
      }
    ]
  }
}
```

Entries are flat: each is one handler object directly in the event's array, and the `matcher` (where the event takes one) sits on that entry. There are no Claude-style matcher groups wrapping a nested `hooks` array.[^copilot-hooks-reference]

Entry types:[^copilot-hooks-reference]

- `command` (default when `type` is omitted): one of `bash`, `powershell`, `command` (cross-platform fallback copied to both), or `exec` + `args` (no shell, CLI only; do not combine `exec` with the others). Optional `cwd` (relative to the repository root, or absolute), `env` (a map; supports variable expansion), `timeoutSec` (default 30; `timeout` is an alias used only when `timeoutSec` is absent), `matcher`. In a sandboxed session `cwd` and `env` widen no access.
- `http`: `url` (HTTPS required by default; must be `https://` for `preToolUse` and `permissionRequest`), optional `headers`, `allowedEnvVars`, `timeoutSec`. Payload is POSTed as JSON.
- `prompt`: `prompt` text auto-submitted; `sessionStart` only, new interactive sessions only.

Event names (camelCase form; a PascalCase form selects the VS Code compatible payload with snake_case fields):[^copilot-hooks-reference]

| Event | PascalCase | Output honoured |
| --- | --- | --- |
| `sessionStart` | `SessionStart` | `additionalContext` |
| `sessionEnd` | `SessionEnd` | none |
| `userPromptSubmitted` | `UserPromptSubmit` | `modifiedPrompt`, SDK programmatic hooks only; command output is dropped |
| `userPromptTransformed` | none | `modifiedTransformedPrompt` |
| `preToolUse` | `PreToolUse` | `permissionDecision` (`allow`/`deny`/`ask`), `permissionDecisionReason`, `modifiedArgs` |
| `postToolUse` | `PostToolUse` | `modifiedResult`, `additionalContext` |
| `postToolUseFailure` | `PostToolUseFailure` | `additionalContext`, by exit code `2` for a command hook |
| `permissionRequest` | `PermissionRequest` | `behavior` (`allow`/`deny`), `message`, `interrupt` |
| `agentStop` | `Stop` | `decision` (`block`/`allow`), `reason` |
| `subagentStart` | none | `additionalContext`, prepended to the subagent's first user message |
| `subagentStop` | `SubagentStop` | `decision` (`block`/`allow`), `reason`, `modifiedResponse` |
| `preCompact` | `PreCompact` | none |
| `errorOccurred` | `ErrorOccurred` | none |
| `notification` | none (payload carries `hook_event_name: "Notification"`) | `additionalContext`, injected as a prepended user message |

`subagentStart` and `notification` have no PascalCase form, so they always arrive in the camelCase field style. The built-in `general-purpose` agent emits neither `subagentStart` nor `subagentStop`.[^copilot-hooks-reference]

### Payloads

The payload form follows the case of the event name in the configuration. A PascalCase name selects the VS Code compatible form: `hook_event_name`, snake_case fields, an ISO 8601 string `timestamp`, and Claude tool names (the table under Compatibility). A camelCase name selects camelCase fields, an epoch-millisecond `timestamp`, and the runtime's lowercase tool names. Every payload carries `cwd`.[^copilot-hooks-reference]

| Event | Fields beyond `sessionId`, `timestamp`, `cwd` (camelCase) |
| --- | --- |
| `sessionStart` | `source` (`startup`, `resume`, `new`); optional `initialPrompt` |
| `sessionEnd` | `reason` (`complete`, `error`, `abort`, `timeout`, `user_exit`) |
| `userPromptSubmitted` | `prompt` |
| `userPromptTransformed` | `prompt`, `transformedPrompt` |
| `preToolUse` | `toolName`, `toolArgs` |
| `postToolUse` | `toolName`, `toolArgs`, `toolResult` (`resultType: "success"`, `textResultForLlm`) |
| `postToolUseFailure` | `toolName`, `toolArgs`, `error` (a string) |
| `agentStop` | `transcriptPath`, `stopReason` (`end_turn`), `stop_hook_active` |
| `subagentStart` | `transcriptPath`, `agentName`; optional `agentDisplayName`, `agentDescription` |
| `subagentStop` | `transcriptPath`, `agentId`, `agentType`, `agentName`, `response`, `stopReason`; optional `agentDisplayName` |
| `errorOccurred` | `error` (`message`, `name`, optional `stack`), `errorContext` (`model_call`, `tool_execution`, `system`, `user_input`), `recoverable` |
| `preCompact` | `transcriptPath`, `trigger` (`manual`, `auto`), `customInstructions` |
| `notification` | `hook_event_name: "Notification"`, `message`, `notification_type`; optional `title` |

In the snake_case form the names become `session_id`, `tool_name`, `tool_input`, `tool_result` (`result_type`, `text_result_for_llm`), `transcript_path`, `stop_reason`, `initial_prompt`, `error_context`, `custom_instructions`, `agent_id`, `agent_type`, `agent_name`, and `last_assistant_message` in place of `response` on `SubagentStop`. `stop_hook_active` keeps its name in both forms. `toolArgs` and `tool_input` are typed `unknown`: the how-to's own example payload shows `toolArgs` as a JSON string (`"{\"command\":\"ls\"}"`), while the VS Code compatible form says the arguments are parsed from a JSON string when possible. A script must accept an object or a string.[^copilot-hooks-reference][^copilot-use-hooks] `notification_type` values are `shell_completed`, `shell_detached_completed`, `agent_completed`, `agent_idle`, `permission_prompt` and `elicitation_dialog`.[^copilot-hooks-reference]

### Outputs

A command hook prints one JSON object on stdout. Lines that are single-line `{"type": "progress", "message": ...}` objects are stripped first, then what remains is parsed with one `JSON.parse`; two final objects concatenate into invalid JSON and are ignored. Output is bounded at 10 MiB.[^copilot-hooks-reference]

- `preToolUse`: `permissionDecision` (`allow`, `deny`, `ask`; empty output uses default behaviour), `permissionDecisionReason` (required for `deny`), and `modifiedArgs`, an object that replaces the arguments. When any hook returns `deny` the tool is blocked.
- `postToolUse`: `modifiedResult` (must carry `resultType: "success"`; a `failure` routes to `postToolUseFailure`) and `additionalContext`, appended to `textResultForLlm`. Several hooks' context is joined with a double newline and capped at 10 KB. `modifiedResult` is honoured for command and HTTP hooks.
- `agentStop` and `subagentStop`: `decision` of `block` or `allow` and `reason`, which becomes the next turn's prompt. `subagentStop` also takes `modifiedResponse`, discarded when the same hook blocks; the last hook to return it wins. After eight consecutive blocks the CLI ends the turn regardless; `stop_hook_active` on `agentStop` lets a hook self-limit.
- `sessionStart` and `subagentStart`: `additionalContext`. Several hooks' strings join with a blank line; an empty string does not erase earlier context.
- `notification`: `additionalContext`, injected as a user message. It can start further agent work if the session is idle. The hook is fire-and-forget and never blocks.
- `permissionRequest`: `behavior`, `message`, `interrupt`. An `allow` does not pre-approve a sandbox-bypass request (`requestSandboxBypass: true`); only `deny` propagates.
- `userPromptSubmitted`: command and HTTP hook output is dropped, including `modifiedPrompt`. Only SDK programmatic hooks can change the prompt.
- Ignored: output from `sessionEnd`, `preCompact` and `errorOccurred`.

### Exit codes

`0` is success and stdout is parsed. `2` is a warning with stderr shown to the user by default, a deny for `preToolUse` and `permissionRequest` (any stdout JSON is merged with the deny, even `allow`), and `additionalContext` for `postToolUseFailure`. Any other non-zero exit is logged and skipped, except `preToolUse`, which fails closed: it denies the call with "Denied by preToolUse hook (hook errored)". Timeouts are fail-open on every event, including `preToolUse` and policy hooks, and HTTP `preToolUse` hooks are fail-open too. A crash, or exit `2`, on a command `preToolUse` hook denies the tool even when its JSON said `allow`.[^copilot-hooks-reference]

Claude Code differs on each of these: an exit `1` from a `PreToolUse` hook proceeds there, and exit `2` on `Stop` blocks there where Copilot only warns ([hooks-fail-open](../decisions/hooks-fail-open.md)).

### Matchers

A `matcher` regex, anchored as `^(?:PATTERN)$`, filters `preToolUse`, `postToolUse` and `permissionRequest` (on `toolName`), `subagentStart` (on `agentName`), `preCompact` (on `trigger`) and `notification` (on `notification_type`). An invalid regex skips the entry. Native tool names are lowercase (`bash`, `view`, `create`, `edit`, `glob`, `grep`, `task`, `web_fetch`, `ask_user`, `powershell`).[^copilot-hooks-reference]

## Marketplace

A marketplace is defined by a `marketplace.json` file; it is the only required component.[^copilot-cli-plugins-marketplace] The documented location is `.github/plugin/marketplace.json`; the CLI checks `marketplace.json`, `.plugin/marketplace.json`, `.github/plugin/marketplace.json`, `.claude-plugin/marketplace.json`, in that order.[^copilot-cli-plugin-reference] A marketplace can be a GitHub repository, any Git URL, or a local directory.[^copilot-cli-plugins-marketplace]

Top-level fields:[^copilot-cli-plugin-reference]

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | Kebab-case, max 64 chars; dots accepted for Agent Plugins 1.0 plugins. Becomes the registration key; no custom local name. |
| `owner` | object | Yes | `{ name, email? }`. |
| `plugins` | array | Yes | Plugin entries. |
| `metadata` | object | No | `{ description?, version?, pluginRoot? }`. |

Plugin entry fields:[^copilot-cli-plugin-reference]

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | Kebab-case, max 64 chars; dots accepted for Agent Plugins 1.0. |
| `source` | string or object | Yes | Relative path (from repository root; leading `./` optional), or an object. |
| `description` | string | No | Max 1024 chars. |
| `version` | string | No | Plugin version. |
| `author` | object | No | `{ name, email?, url? }`. |
| `homepage`, `repository`, `license`, `category` | string | No | |
| `keywords`, `tags` | string[] | No | |
| `commands`, `agents`, `skills` | string or string[] | No | Component directory paths. |
| `hooks` | string or object | No | Hooks config path or inline object. |
| `mcpServers` | string or object | No | Inline map or config path; used when the plugin source ships no MCP config. |
| `lspServers` | string or object | No | LSP config path or inline definitions. |
| `strict` | boolean | No | Default `true` (full schema validation); `false` relaxes validation. |

Object sources: `{ "source": "github", "repo": "owner/repo", "ref"?, "path"?, "sha"? }`, and a `url` source type; both accept `sha`, a full 40-character commit SHA, in addition to or instead of `ref`.[^copilot-cli-plugin-reference]

Marketplaces can also be declared in settings via `extraKnownMarketplaces` (keyed by name; required `source` of `"directory"`, `"git"`, or `"github"`; optional `autoUpdate`), and plugins enabled declaratively via `enabledPlugins` (`Record<string, boolean>` keyed by plugin spec), in `~/.copilot/settings.json` or `.github/copilot/settings.json`.[^copilot-cli-config-dir-reference] Built-in marketplaces `copilot-plugins` and `awesome-copilot` are registered by default and cannot be removed.[^copilot-cli-plugin-reference]

## Installation behaviour

Install specs for `copilot plugin install`: `plugin@marketplace`, `OWNER/REPO`, `OWNER/REPO:PATH/TO/PLUGIN`, a Git URL, or a local path. `copilot plugin uninstall` takes the manifest `name`, not the path.[^copilot-cli-plugin-reference][^copilot-cli-plugins-creating] `--plugin-dir=DIRECTORY` loads a plugin from a local directory for a session without installing it (repeatable).[^copilot-cli-command-reference]

- Installed plugins are copied to `~/.copilot/installed-plugins/MARKETPLACE/PLUGIN-NAME` (marketplace) or `~/.copilot/installed-plugins/_direct/SOURCE-ID/` (direct).[^copilot-cli-plugin-reference]
- Components are cached at install; subsequent sessions read from the cache, so a local plugin must be reinstalled to pick up changes.[^copilot-cli-plugins-creating] Exception: path-sourced plugins in a local directory-source marketplace load live from their real directory and pick up edits on `/restart` or a new session.[^copilot-cli-plugin-reference]
- Marketplace catalogs are cached in `~/.cache/copilot/marketplaces/` (Linux) or `~/Library/Caches/copilot/marketplaces/` (macOS), overridable with `COPILOT_CACHE_HOME`.[^copilot-cli-plugin-reference]
- First-party plugins auto-update at session start in a trusted directory (disable with `autoUpdate: false` or `COPILOT_AUTO_UPDATE=false`; skipped in CI). User-added marketplaces opt in with `autoUpdate: true` on their `extraKnownMarketplaces` entry in user or managed settings; a repository-level `autoUpdate` is ignored.[^copilot-cli-plugin-reference]
- A plugin enabled only through a repository's `enabledPlugins` is scoped to that repository and stays disabled globally.[^copilot-cli-config-dir-reference]
- Managed (MDM/organization) `enabledPlugins` and `extraKnownMarketplaces` entries cannot be toggled or repointed locally.[^copilot-cli-plugin-reference]

## Compatibility with Claude Code plugins

- Legacy manifest discovery includes `.claude-plugin/plugin.json` (checked last), and marketplace discovery includes `.claude-plugin/marketplace.json` (checked last).[^copilot-cli-plugin-reference]
- GitHub lists `claude-code-plugins` (`anthropics/claude-code`) and `claudeforge-marketplace` as example marketplaces, and documents `copilot plugin marketplace add anthropics/claude-code`.[^copilot-about-plugins]
- `${CLAUDE_PLUGIN_DATA}` is accepted as an alias of `${PLUGIN_DATA}` in Agent Plugins `stdio` MCP config, and `${CLAUDE_PLUGIN_ROOT}` as an alias of `${PLUGIN_ROOT}` only inside a plugin agent's `mcp-servers` block. No alias of either is documented for hook commands.[^copilot-cli-plugin-reference] A probe, loaded in place and installed, found hook commands run from the plugin root with `${PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_ROOT}` substituted, while `${COPILOT_PLUGIN_ROOT}` stayed literal in a hook command: the documented `${COPILOT_PLUGIN_ROOT}` alias covers MCP configuration and a plugin agent's `mcp-servers` block only ([measurement](../measurements/copilot-plugin-hook-environment.md)).
- Hooks configured with PascalCase event names (`PreToolUse`, `PermissionRequest`), "as used in Claude Code plugins and the Open Plugins format", apply Claude matcher semantics (`*`/`**`/empty match all; literal or `|` alternation; otherwise anchored regex) against Claude tool names, and the payload reports Claude tool names. Mapping: `bash`/`powershell` → `Bash`, `view` → `Read`, `create` → `Write`, `edit`/`str_replace_editor`/`apply_patch` → `Edit`, `grep`/`rg` → `Grep`, `glob` → `Glob`, `web_fetch` → `WebFetch`, `web_search` → `WebSearch`, `ask_user` → `AskUserQuestion`, `update_todo` → `TodoWrite`, `task` → `Agent` (literal `Task` also accepted).[^copilot-hooks-reference]
- The CLI reads `.claude/agents/`, `.claude/skills/`, `.claude/commands/`, `.claude/rules/**/*.md`, and the cross-tool subset of `.claude/settings.json` / `.claude/settings.local.json` (`enabledPlugins`, `extraKnownMarketplaces`, `hooks`, `disableAllHooks`, `companyAnnouncements`) at project level.[^copilot-cli-command-reference][^copilot-cli-config-dir-reference]

[^copilot-cli-plugin-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
[^copilot-cli-plugins-creating]: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating>
[^copilot-cli-plugins-marketplace]: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace>
[^copilot-about-plugins]: <https://docs.github.com/en/copilot/concepts/agents/about-plugins>
[^copilot-hooks-reference]: <https://docs.github.com/en/copilot/reference/hooks-configuration>
[^copilot-use-hooks]: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks>
[^copilot-cli-command-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference>
[^copilot-cli-config-dir-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference>
