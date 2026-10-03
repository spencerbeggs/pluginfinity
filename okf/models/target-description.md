---
type: DataModel
title: Target description
description: The shape of core's Target schema — manifest, plugin-root spellings, component field maps, hook event tables, MCP and reference rendering — and the per-host values targets holds, as designed for the first release.
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
generated:
  by: okfit/claude-code
  at: 2026-10-03T01:28:45Z
  body_sha256: dee5b27e3cd6d292c54bf13016e93dbfadbff8b9bf42d4def065484a46458606
---

# Target description

This is the agreed design for Phase 1 of [the roadmap](../roadmaps/pluginfinity-first-release.md).[^owner-direction] Core defines the `Target` schema; `@pluginfinity/targets` holds one decoded value per host. It is data plus a closed set of named formats ([decision](../decisions/targets-are-data-plus-named-formats.md)), and it maps the [source model](plugin-source-model.md) onto each host.

## Parts

- **`manifest`.** A `path`, a `format` (`"claude-plugin-json"` or `"agent-plugins-1.0"`, with its pinned `$schema`), and the allowlist of keys the build may write.
- **`pluginRoot`.** The root's spelling per site: hook commands, MCP config, and skill and agent bodies. Any site can be unresolved.
- **`skills` and `agents`.** The directory, the agent file suffix, and a field map over every core frontmatter field.
- **`hooks`.** A `path`, a `format` (`"claude-hooks-json"` or `"copilot-hooks-v1"`), a table from each Claude Code event to the target's name or `absent`, and the target's own event names.
- **`mcp`.** A `path` and a `format` (`"claude-mcp-json"` or `"agent-plugins-mcp-1.0"`).
- **`references`.** How a `pluginfinity://` link renders: as a path under the root's body spelling, or as prose ("the `<skill>` skill's `<path>`"), plugin-bot's Copilot convention.
- **`tools`.** A table translating Claude Code tool names for agent `tools` and hook matchers.

## Field-map entries

| Entry | Meaning | Example |
| :-- | :-- | :-- |
| `keep` | Written unchanged | `description` |
| `rename` | Written under another name | `effort` becomes `reasoningEffort` |
| `translate` | Value mapped through a table | agent `tools` through `tools` |
| `degrade` | Moved into a named form | `paths:` becomes a `description` suffix; agent `skills:` becomes a body section |
| `drop` | Not written; the host lacks it | `color` on Copilot |
| `unresolved` | The docs leave it open | uses the component's fallback, or fails |

The degrade forms are a closed set owned by the engine, for now `"description-suffix"` and `"body-section"`. Dropping a field is silent; building a degraded form is reported at info level.

## The two first values

| Part | `claude` | `copilot` |
| :-- | :-- | :-- |
| Manifest | `.claude-plugin/plugin.json` | root `plugin.json`, Agent Plugins 1.0 |
| Skills | `skills/` | `skills/` |
| Agents | `agents/<name>.md` | `com.github.copilot/agents/<name>.agent.md` |
| Hooks | `hooks/hooks.json`, `command`, `timeout` | `com.github.copilot/hooks/hooks.json`, `bash`, `timeoutSec`, PascalCase names where Copilot has them |
| MCP | `.mcp.json` | root `mcp.json` with `$schema`, `http` as `streamable-http` |
| Root in hooks and MCP | `${CLAUDE_PLUGIN_ROOT}` | `${PLUGIN_ROOT}` |
| Root in bodies | `${CLAUDE_PLUGIN_ROOT}` | unresolved, so references render as prose |

The Copilot hook cells rest on two measurements: hooks run from the plugin root with `${PLUGIN_ROOT}` substituted ([environment](../measurements/copilot-plugin-hook-environment.md)), a PascalCase `PreToolUse` deny in Claude's shape is honoured ([deny](../measurements/copilot-claude-style-pretooluse-deny.md)), and a PascalCase `SessionStart` hook's flat `additionalContext` reaches the model ([session start](../measurements/copilot-pascalcase-sessionstart-context.md)). Host facts come from the [references](../references/index.md), and where SchemaStore and the host docs disagree, the docs win.

## Invariants the tests pin

- Every field map covers every core frontmatter field, so a field added to core cannot build until each host says what it does with it.
- Every Claude Code event appears in each target's event table.
- Every format literal and degrade form has an engine implementation.

[^owner-direction]: conversation with the repository owner, 2026-10-02
