---
type: Decision
title: The copilot target emits Agent Plugins 1.0
description: pluginfinity's copilot target writes plugins in the Agent Plugins 1.0 (Open Plugin Spec) format, not Copilot CLI's legacy plugin format.
status: stable
tags:
  - portability
  - github
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The owner's choice to target Agent Plugins 1.0 directly
  - id: copilot-cli-plugin-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
    title: GitHub Copilot CLI plugin reference
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:08:02Z
  body_sha256: 99732066cde8cf51bfe05ba99897b1aabebd6c5b7eefcca38ef32f8465bb93c4
verified:
  - by: human:spencer
    at: 2026-10-06T03:11:19Z
---

# The copilot target emits Agent Plugins 1.0

## Context

Copilot CLI loads two plugin formats. A root `plugin.json` whose `$schema` is exactly the Agent Plugins 1.0.0 or 1.1.0 schema URL opts into Agent Plugins semantics; any other manifest loads as the legacy format, found at one of four locations.[^copilot-cli-plugin-reference] plugin-bot's hand-maintained Copilot copy uses the legacy root `plugin.json`. The two formats differ in layout, in which manifest keys exist and in how components are found ([Copilot plugin format](../references/copilot-cli-plugin-format.md)).

The alternative was to emit legacy first, which would have kept the Phase 3 comparison with plugin-bot one-to-one, and add Agent Plugins later. The repository owner chose to go to Agent Plugins directly.[^owner-direction]

## Decision

- `builds/copilot/` is an Agent Plugins 1.0 plugin: a root `plugin.json` carrying the canonical `$schema`, and only the manifest keys the spec allows.
- Components sit at the spec's fixed locations: `skills/<name>/SKILL.md` and a root `mcp.json` with its own `$schema`. Copilot-only components (agents, commands, rules, hooks, LSP) go under `com.github.copilot/`.
- The copilot target emits no legacy manifest and no component-path keys.

## Consequences

- The `Target` description for copilot is a fixed layout rather than a set of configurable paths, which fits describing hosts as data.
- An Agent Plugins version Copilot CLI does not support is rejected outright, with no fallback to legacy,[^copilot-cli-plugin-reference] so the build pins the `$schema` it writes.
- Comparing the companion's generated Copilot output with plugin-bot's legacy copy (roadmap Phase 3) compares content, not layout.
- How a plugin hook command finds the plugin root under Copilot is not settled by the docs; see the [roadmap](../roadmaps/pluginfinity-first-release.md)'s open questions.

[^owner-direction]: conversation with the repository owner, 2026-10-02
[^copilot-cli-plugin-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
