---
type: Decision
title: Claude Code's names are the source vocabulary
description: Plugin source writes hook events, tool names and skill and agent frontmatter fields with Claude Code's names, and each target maps them; per-host additions go in a targets block.
status: draft
tags:
  - portability
  - dx
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The owner's choices of the event, frontmatter and reference vocabularies during the Phase 1 design
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:36:46Z
  body_sha256: 68a36198fdd1df8e86bb6a20c8742b1fab97b2186151a715c254f7d5f5c92c14
---

# Claude Code's names are the source vocabulary

## Context

A host-neutral source still has to spell its hook events, tool names and frontmatter fields somehow. Claude Code has the largest vocabulary of the hosts pluginfinity targets: 33 hook events, about 20 skill fields and a full agent field set ([skills](../references/skill-frontmatter.md), [agents](../references/agent-frontmatter.md), [Claude Code plugins](../references/claude-code-plugin-format.md)). Copilot accepts PascalCase event names and Claude tool names, and then sends a Claude-shaped payload and honours a Claude-shaped deny ([measurement](../measurements/copilot-claude-style-pretooluse-deny.md)).

The alternatives were a pluginfinity-neutral vocabulary mapped onto every host, which is a third set of names for authors to learn and leaves the payload shape open, and each host's native names, which gives a hook script two payload shapes.[^owner-direction]

## Decision

- Hook events in `pluginfinity.config.ts` use Claude Code's names (`PreToolUse`, `Stop`), and matchers use Claude tool names (`Bash`, `Edit|Write`). The Copilot target emits the PascalCase form wherever Copilot has one.
- Skill and agent frontmatter use Claude Code's field names. Each target's field map keeps, renames, translates, degrades or drops each field ([target description](../models/target-description.md)).
- What only one host has goes in a per-target place: a target's own event names under that target's `hooks` override, and host-only frontmatter fields under the component's `targets.<id>` block, which is stripped on emit ([source model](../models/plugin-source-model.md)).
- References between components use the `pluginfinity://skill/<skill>[/<path>]` and `pluginfinity://agent/<agent>` link schemes, which are pluginfinity's own because no host has a cross-reference syntax.[^owner-direction]

## Consequences

- An author who knows Claude Code plugins already knows the vocabulary.
- A Claude Code rename becomes a core change and a targets change together, not a source change in every plugin.
- An event or field Claude Code lacks can only be written for one host at a time, through its override.

[^owner-direction]: conversation with the repository owner, 2026-10-02
