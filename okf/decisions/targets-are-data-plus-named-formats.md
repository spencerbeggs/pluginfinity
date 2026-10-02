---
type: Decision
title: Targets are data plus a closed set of named formats
description: A target is a decoded description of tables and facts, and where a host's output is structural it names a format literal whose single encoder the engine owns.
status: draft
tags:
  - architecture
  - portability
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The owner's approval of the data-plus-formats approach during the Phase 1 design
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:36:46Z
  body_sha256: 7765f3bf65897152e8c4f99d61307443c9e9ee8e1efc2980e1ac1731dd816523
---

# Targets are data plus a closed set of named formats

## Context

The roadmap wants hosts described by capability, as data, so a corrected host fact is a targets release and special cases cannot leak into shared code the way they did in impeccable ([roadmap](../roadmaps/pluginfinity-first-release.md)). Some host differences are tables (field renames, event names, paths), but some are structural: Claude Code's hooks file nests handlers under matcher groups, and Copilot's is a flat, versioned list with different handler keys ([Claude Code](../references/claude-code-plugin-format.md), [Copilot](../references/copilot-cli-plugin-format.md)).

Two alternatives were rejected. Pure data would need a small templating language to express the structural differences. Code per target, as an Effect service with emit methods, would hide host facts in functions.[^owner-direction]

## Decision

- A target is one decoded value of core's `Target` schema, held in `@pluginfinity/targets`.
- Where an output is structural, the target names a format by literal (`"claude-hooks-json"`, `"copilot-hooks-v1"`, `"agent-plugins-1.0"`). Moving content into another form names a degrade form the same way (`"description-suffix"`, `"body-section"`).
- `@pluginfinity/engine` owns exactly one encoder per format literal and one renderer per degrade form. Targets holds no functions.
- Any table cell can be `unresolved` with a note on what the docs leave open. Reaching one uses the component's declared fallback, or fails the build with the note.

## Consequences

- A new host that reuses known formats is a data change only; a genuinely new shape adds one engine encoder and one literal.
- The literal sets live in core so both targets and engine see them, and a test pins that every literal has an engine implementation.
- Host facts stay greppable as data, at the cost of a fixed vocabulary of forms that only grows by an engine release.

[^owner-direction]: conversation with the repository owner, 2026-10-02
