---
type: DataModel
title: Target description
description: The shape of core's Target schema — manifest, plugin-root spellings, component field maps, hook event tables, MCP and LSP config, and reference rendering — and the per-host values targets holds, as designed for the first release.
status: draft
tags:
  - architecture
  - portability
resource: ../../packages/targets/src/
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The Phase 1 design agreed with the repository owner, section by section
  - id: copilot-target
    resource: ../../packages/targets/src/copilot.ts
    title: The Copilot target value, with its LSP field map
  - id: servers
    resource: ../../packages/engine/src/servers.ts
    title: The MCP and LSP encoders
generated:
  by: okfit/claude-code
  at: 2026-10-06T00:41:19Z
  body_sha256: 741652b1da19040516b3af4f7a98a02c1394d080b0a8536dd6fa9666efe0e642
---

# Target description

This is the agreed design for Phase 1 of [the roadmap](../roadmaps/pluginfinity-first-release.md).[^owner-direction] Core defines the `Target` schema; `@pluginfinity/targets` holds one decoded value per host. It is data plus a closed set of named formats ([decision](../decisions/targets-are-data-plus-named-formats.md)), and it maps the [source model](plugin-source-model.md) onto each host.

## Parts

- **`manifest`.** A `path`, a `format` (`"claude-plugin-json"` or `"agent-plugins-1.0"`, with its pinned `$schema`), and the allowlist of keys the build may write.
- **`pluginRoot`.** The root's spelling per site: hook commands, MCP config, LSP config, and skill and agent bodies. Any site can be unresolved.
- **`skills` and `agents`.** The directory, the agent file suffix, and a field map over every core frontmatter field.
- **`hooks`.** A `path`, a `format` (`"claude-hooks-json"` or `"copilot-hooks-v1"`), a table from each Claude Code event to the target's name or `absent`, and the target's own event names.
- **`mcp`.** A `path`, a `format` (`"claude-mcp-json"` or `"agent-plugins-mcp-1.0"`) and an optional `$schema`. MCP has no field map; the host differences are the `type` and `cwd` rules below.
- **`lsp`.** A `path`, a `format` (`"claude-lsp-json"` or `"copilot-lsp-json"`) and a field map over every core LSP field. A server field takes `keep`, `rename`, `drop` or `unresolved`.
- **`references`.** How a `pluginfinity://` link renders: as a path under the root's body spelling, or as prose ("the `<skill>` skill's `<path>`"), plugin-bot's Copilot convention.
- **`tools`.** A table translating Claude Code tool names in agent `tools` and skill `allowed-tools`; a name maps to the target's name, `drop`, or `unresolved`, and an unlisted name follows the target's `tools.unlisted`: kept on Claude Code, dropped on Copilot, which has no Claude-only tools such as `ToolSearch` and no name for another plugin's MCP server. Claude's `mcp__<server>__<tool>` names are rewritten to the target's MCP spelling, and so is the plugin's own `mcp__plugin_<plugin>_<server>__<tool>` when `<server>` is one the target declares (Claude Code keeps it as written), and a rule such as `Bash(git log:*)` on a tool the target renames is unresolved, since dropping the rule would widen the tool. Hook matchers are written unchanged: Copilot applies Claude matcher semantics to Claude tool names under the PascalCase events.
- **`models` and `efforts`.** Tables translating Claude Code model names and effort levels; a value maps to the target's value, `drop`, which leaves the field out, or `unresolved`. Copilot drops `inherit`, since an agent with no model inherits the session's, leaves Claude's model aliases and the `xhigh` and `max` efforts unresolved, and writes `effort` as `reasoningEffort`.

## Field-map entries

| Entry | Meaning | Example |
| :-- | :-- | :-- |
| `keep` | Written unchanged | `description` |
| `rename` | Written under another name | `effort` becomes `reasoningEffort` |
| `translate` | Value mapped through a table | agent `tools` through `tools` |
| `degrade` | Moved into a named form | `paths:` becomes a `description` suffix; agent `skills:` becomes a body section |
| `drop` | Not written; the host lacks it | `color` on Copilot |
| `unresolved` | The docs leave it open | uses the component's fallback, or fails |

The degrade forms are a closed set owned by the engine, for now `"description-suffix"` and `"body-section"`. A dropped or degraded field, a tool with no spelling on the target and an omitted hook event are each reported as an info-level build note, which never fails the build; a value a translation table drops, such as `model: inherit` on Copilot, is not ([decision](../decisions/build-notes-report-dropped-fields.md)).

## The two first values

| Part | `claude` | `copilot` |
| :-- | :-- | :-- |
| Manifest | `.claude-plugin/plugin.json` | root `plugin.json`, Agent Plugins 1.0 |
| Skills | `skills/` | `skills/` |
| Agents | `agents/<name>.md` | `com.github.copilot/agents/<name>.agent.md` |
| Hooks | `hooks/hooks.json`, `command`, `timeout` | `com.github.copilot/hooks/hooks.json`, `bash`, `timeoutSec`, PascalCase names where Copilot has them |
| MCP | `.mcp.json`, `{ "mcpServers": … }` | root `mcp.json`, `{ "$schema", "mcpServers": … }` |
| MCP `type` | as written | `"stdio"` written on every local server, `http` as `streamable-http`, `sse` kept |
| MCP `cwd` | any `cwd` fails the build | kept, root rewritten |
| LSP | `.lsp.json`, server name to config | `com.github.copilot/lsp.json`, `{ "lspServers": … }` |
| Root in hooks, MCP and LSP | `${CLAUDE_PLUGIN_ROOT}` | `${PLUGIN_ROOT}` |
| Root in bodies | `${CLAUDE_PLUGIN_ROOT}` | unresolved, so references render as prose |

Neither manifest names the server files; both hosts load them from their default locations, and a target with no servers of a kind gets no file for it.[^servers]

| LSP field | `claude` | `copilot` |
| :-- | :-- | :-- |
| `command`, `args`, `env`, `initializationOptions` | keep | keep |
| `extensionToLanguage` | keep | rename to `fileExtensions` |
| `startupTimeout`, `shutdownTimeout`, `restartOnCrash`, `maxRestarts`, `diagnostics` | keep | drop |
| `workspaceFolder` | keep | unresolved: Copilot's `rootUri` is relative to the git root |
| `settings` | keep | unresolved: Copilot has no settings channel |

An unresolved LSP field fails the Copilot build, and the finding says to set that server under `copilot.lspServers` without the field.[^copilot-target] The server cells rest on [the server measurement](../measurements/plugin-server-environment.md): Claude ignores a plugin MCP server's `cwd` and starts it in the project directory, so the encoder refuses any `cwd` rather than write one that does nothing; Copilot loads no MCP entry without a `type`; and Copilot rejects an LSP entry without `fileExtensions`.

The Copilot hook cells rest on two measurements: hooks run from the plugin root with `${PLUGIN_ROOT}` substituted ([environment](../measurements/copilot-plugin-hook-environment.md)), a PascalCase `PreToolUse` deny in Claude's shape is honoured ([deny](../measurements/copilot-claude-style-pretooluse-deny.md)), and a PascalCase `SessionStart` hook's flat `additionalContext` reaches the model ([session start](../measurements/copilot-pascalcase-sessionstart-context.md)). Host facts come from the [references](../references/index.md), and where SchemaStore and the host docs disagree, the docs win.

## Invariants the tests pin

- Every field map covers every core frontmatter field, and every LSP field map every core LSP field, so a field added to core cannot build until each host says what it does with it.
- Every Claude Code event appears in each target's event table.
- Every format literal and degrade form has an engine implementation.

[^owner-direction]: conversation with the repository owner, 2026-10-02
[^copilot-target]: `../../packages/targets/src/copilot.ts`
[^servers]: `../../packages/engine/src/servers.ts`
