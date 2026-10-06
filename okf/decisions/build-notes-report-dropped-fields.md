---
type: Decision
title: Build notes report what a target drops, degrades or omits
description: Every build and validate reports, at info level and without failing, each frontmatter or server field a target drops or degrades, each tool it cannot name and each hook event it omits, replacing the rule that a dropped field is silent.
status: draft
tags:
  - dx
  - portability
sources:
  - id: okfit-findings
    resource: okfit round-1 dogfood findings mail, 2026-10-05
    title: okfit's round-1 dogfood findings, item 1
    last_modified: 2026-10-05T00:00:00Z
  - id: notes
    resource: ../../packages/engine/src/notes.ts
    title: BuildNote, BUILD_NOTE_KINDS and sortNotes
  - id: frontmatter
    resource: ../../packages/engine/src/frontmatter.ts
    title: mapFrontmatter and its drops
  - id: render-build
    resource: ../../packages/cli/src/render/build.ts
    title: The note lines and the notes JSON
generated:
  by: okfit/claude-code
  at: 2026-10-06T00:41:19Z
  body_sha256: 0430aa30ead2297b71c53832c1fcb13278dd76567929de3e3a106f44b706de4e
---

# Build notes report what a target drops, degrades or omits

## Context

The [target description](../models/target-description.md) said dropping a field is silent. That held until okfit migrated its plugin: every `mcp__plugin_okfit_mcp__<tool>` name in two agents and four skills was dropped from the Copilot build, and nothing in the build said so.[^okfit-findings] A field map drop is a design choice, so failing the build would be wrong, but an author cannot check a drop nobody reports.

## Decision

- Every `build`, `build --check` and `validate` returns a list of info-level notes per target. A note is `{target, path, kind, name}` and never fails a command.[^notes]
- The kinds, in their sort and print order:
  - `dropped`: a field the target's field map drops. This includes Claude Code's own drops of an agent's `permissionMode`, `mcpServers`, `hooks` and `initialPrompt`, and an LSP server field a target drops, named `<origin>.<server>.<field>`.
  - `degraded`: a field moved into another form, a `description` suffix or a body section. A field is not reported when the component's `targets` block sets that host's `description`, since nothing is folded into it.
  - `tool-dropped`: a tool name the target cannot spell, or one its table drops.[^frontmatter]
  - `hook-omitted`: an event the target lacks whose entries all set `fallback: "omit"`.
- A value a translation table drops, such as `model: inherit` on Copilot, gets no note: the host's default is the same value, so nothing is lost.
- `path` is the component's source path (`agents/<name>.md`, `skills/<name>/SKILL.md`), or `config` for hooks and servers. Notes are de-duplicated and sorted by path with `config` last, then kind, then name.
- People get one indented line per component under the target's `✓` line, `· <path>: <kind> <names>; <kind> <names>`. Agents and CI get a `notes` array of `{path, kind, name}` on each build and each validation.[^render-build]

## Consequences

- An author sees every drop on every build, and a surprising one, like a plugin's own MCP tools, shows up the first time.
- A plugin that targets both hosts always has Copilot notes, so the output is longer. Notes stay one line per component to keep it readable.
- Notes are not findings, so no exit code or `--strict` mode depends on them. A drop that should fail belongs in the field map as `unresolved`.

## Alternatives rejected

- **Keep drops silent.** That is what hid the dropped MCP tools.
- **Warnings that fail under a strict flag.** A drop is the field map working as designed; failing on it would push authors to hide fields in `targets` blocks.
- **A note for every dropped value.** A value-table drop changes nothing the host does, so it would only add noise.

[^okfit-findings]: okfit round-1 dogfood findings mail, 2026-10-05 (item 1)
[^notes]: `../../packages/engine/src/notes.ts`
[^frontmatter]: `../../packages/engine/src/frontmatter.ts`
[^render-build]: `../../packages/cli/src/render/build.ts`
