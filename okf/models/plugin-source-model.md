---
type: DataModel
title: Plugin source model
description: The host-neutral shape of a plugin's source that pluginfinity reads, decodes and builds from — skills, agents, hooks, MCP servers and the config fields that declare them — as designed for the first release.
status: draft
tags:
  - architecture
  - portability
resource: ../../packages/core/src/
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The Phase 1 design agreed with the repository owner, section by section
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:36:46Z
  body_sha256: 36d7233ba88b4e38d5f309e6c16fe371eccd1684e02842ecf573aa2986c531a0
---

# Plugin source model

This is the agreed design for Phase 1 of [the roadmap](../roadmaps/pluginfinity-first-release.md); the schemas land in `@pluginfinity/core` in Phase 2.[^owner-direction] Names follow [Claude Code's vocabulary](../decisions/claude-code-names-are-the-source-vocabulary.md), and the per-host side is the [target description](target-description.md).

## Layout

```text
plugins/<name>/
  pluginfinity.config.ts      name, metadata, targets, hooks, mcpServers, scripts
  skills/<skill>/SKILL.md      plus any scripts/, references/, assets/
  agents/<agent>.md
  hooks/*.sh                  any path, referenced from the config
```

The first release covers four component kinds: skills, agents, hooks and MCP servers. Commands, LSP servers, output styles, themes and monitors are out of scope. Runtime content is markdown, JSON and bash only ([decision](../decisions/plugins-carry-no-node-dependencies.md)).

## Skills and agents

- **`Skill`.** Its name is its directory name. It must satisfy the Agent Skills spec rule (1 to 64 characters of `a-z`, `0-9` and `-`, no leading, trailing or doubled hyphen), the strictest of the hosts, and equal the frontmatter `name` when one is set. It holds a `SkillFrontmatter`, a body, and its other files.
- **`Agent`.** Its name is its file stem and must equal the frontmatter `name`, which satisfies both Claude Code (identity by `name`) and Copilot (identity by file name). It holds an `AgentFrontmatter` and a body.
- **Frontmatter** uses Claude Code's field names. An unknown field fails decoding, so a misspelt field never ships silently.
- **`targets` block.** Optional in either frontmatter, keyed by target id. `false` excludes the component from that target; an object holds fields for that host only, including fields Claude Code lacks (`handoffs` for Copilot). The block is always stripped on emit, and an unknown target id fails.
- **Support files** in a skill directory are copied verbatim, except `.md` files, which get the same body processing as `SKILL.md`.

## Body constructs

- **Host blocks.** `<!-- pluginfinity:only <id> [<id>…] -->` … `<!-- /pluginfinity:only -->` keeps the enclosed passage for the listed targets and strips it for the rest. Blocks do not nest; an unclosed block or an unknown id fails.
- **References.** A markdown link destination `pluginfinity://skill/<skill>[/<path>]` or `pluginfinity://agent/<agent>` must name a component, and a file, that exists. Each target rewrites it ([target description](target-description.md)). Both forms pass the repository's markdownlint config.

Whole-file overrides per target are out of scope until a plugin needs them.[^owner-direction]

## Config additions

```ts
export default defineConfig({
  name: "pluginfinity-dogfood",
  description: "End-to-end fixture for the pluginfinity CLI",
  author: { name: "C. Spencer Beggs" },
  scripts: { invoke: "bash" },
  hooks: {
    PreToolUse: [{ matcher: "Bash", script: "hooks/guard-bash.sh", timeout: 10 }],
    Stop: [{ command: 'bash "${PLUGIN_ROOT}/hooks/on-stop.sh" --quiet', fallback: "omit" }],
  },
  mcpServers: {
    docs: { type: "http", url: "https://example.com/mcp" },
  },
  claude: true,
  copilot: {
    hooks: { subagentStart: [{ script: "hooks/brief.sh" }] },
  },
});
```

- **Metadata.** `description` is required; `author`, `homepage`, `repository`, `license` and `keywords` are optional. `version` is still copied from `package.json`.
- **A hook entry** has exactly one of `script` (a path from the plugin root) or `command` (a string whose one placeholder is `${PLUGIN_ROOT}`), and optional `matcher`, `args` (with `script` only), `timeout` in seconds and `fallback`. HTTP and prompt hook types are out of scope.
- **`fallback`** says what a target that lacks the event does: `"fail"` (the default) or `"omit"`.
- **`scripts.invoke`.** `"bash"`, the default, emits `bash "<root>/<path>"` and ignores the file mode, because this repository keeps scripts in git without the executable bit and restores it locally. `"exec"` emits the bare quoted path and fails a build whose shipped `.sh` files are not executable in the source.
- **`mcpServers`** uses Claude Code's `.mcp.json` server shape: `command`, `args`, `env`, or `type` with `url` and `headers`. `${PLUGIN_ROOT}` is the one placeholder in `args`, `env` and `cwd`.
- **Target overrides.** `TargetOverride` grows from `name` to `name`, `hooks` and `mcpServers`, typed per target. An event under a target's `hooks` replaces the base entries for that event on that target, `[]` removes them, and a target may name its own events Claude Code lacks. A server under a target's `mcpServers` replaces the base server of that name.

The current contract, before these additions, is the [config interface](../interfaces/config.md).

[^owner-direction]: conversation with the repository owner, 2026-10-02
