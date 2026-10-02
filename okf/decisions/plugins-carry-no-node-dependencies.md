---
type: Decision
title: Built plugins carry no Node dependencies
description: For the first release, a plugin pluginfinity builds is markdown, JSON and bash scripts only, with no Node runtime dependencies to install.
status: draft
tags:
  - deps
  - portability
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The owner's choice to start with bash scripts and markdown only
  - id: claude-plugins-loading
    resource: https://code.claude.com/docs/en/plugins/loading.md
    title: How Claude Code loads plugins
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:08:02Z
  body_sha256: 9469b54a17842b6f8b4620999abc00d1faab3b407d89a3809a7c26de445b705a
---

# Built plugins carry no Node dependencies

## Context

Claude Code installs a plugin's Node dependencies only from `bun.lock`, `npm-shrinkwrap.json` or `package-lock.json`. A plugin that ships `pnpm-lock.yaml` or `yarn.lock` gets no install.[^claude-plugins-loading] Plugins in this repository are pnpm workspaces, so supporting runtime dependencies would mean bundling them or generating an npm lockfile per build ([Claude Code plugin format](../references/claude-code-plugin-format.md)). The repository owner chose to start without them.[^owner-direction]

## Decision

- A plugin's runtime content is markdown, JSON and bash scripts. Hook and skill scripts are bash.
- `builds/<target>/` contains no `package.json` dependencies, no lockfile and no `node_modules`.
- A plugin's own `package.json` dependencies are build-time only (pluginfinity itself) and never reach `builds/`.

## Consequences

- The build has no dependency-install or bundling step, and the pnpm-lockfile limitation does not arise.
- Compiled hooks (prior art in [claude-binary-plugin](../references/claude-binary-plugin.md)) and Node-based MCP servers are out of scope until this is revisited.
- The check stage can fail a build whose output contains a lockfile or `node_modules`.

[^owner-direction]: conversation with the repository owner, 2026-10-02
[^claude-plugins-loading]: <https://code.claude.com/docs/en/plugins/loading.md>
