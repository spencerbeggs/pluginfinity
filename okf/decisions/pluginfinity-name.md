---
type: Decision
title: The tool is named pluginfinity
description: pluginfinity names the CLI, its carrier package, its bin and its config file, with the layer packages under the @pluginfinity npm scope.
status: stable
tags:
  - dx
  - release
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The owner's choice of the name and registration of the npm scope
  - id: npm-registry
    resource: https://registry.npmjs.org/pluginfinity
    title: npm registry lookup for the unscoped name
  - id: carrier-manifest
    resource: ../../packages/pluginfinity/package.json
    title: The carrier manifest, which declares the pluginfinity name and bin
generated:
  by: okfit/claude-code
  at: 2026-10-02T19:38:56Z
  body_sha256: f3851e2e7ad18fcebb3995abf3872e9623b6066d260515c4936a948edadf050e
verified:
  - by: human:spencer
    at: 2026-10-06T03:11:19Z
---

# The tool is named pluginfinity

## Context

The tool needs one name for its npm packages, its command, its config file and its environment variables, settled before the first npm publish fixes it. The repository owner chose pluginfinity, a blend of "plugin" and "infinity", and registered the `@pluginfinity` npm scope.[^owner-direction]

## Decision

- The CLI, its command and its carrier package are named `pluginfinity`, and the bin is `pluginfinity`.[^carrier-manifest]
- The layer packages publish as `@pluginfinity/core`, `@pluginfinity/targets`, `@pluginfinity/engine` and `@pluginfinity/cli` ([carrier decision](pluginfinity-ships-as-a-carrier-package.md)).
- A plugin's config file is `pluginfinity.config.{ts,mts,js,mjs}`, and the environment variables are `PLUGINFINITY_AUDIENCE` and `PLUGINFINITY_LOG_LEVEL`.
- The repository is `spencerbeggs/pluginfinity`.

## Consequences

- On 2026-10-02 the unscoped `pluginfinity` name and its punctuation variants returned 404 from the npm registry.[^npm-registry] The `@pluginfinity` scope is registered, but nothing reserves the unscoped name before the first publish, and the carrier's manifest is still `private: true`.

[^owner-direction]: conversation with the repository owner, 2026-10-02
[^npm-registry]: <https://registry.npmjs.org/pluginfinity>
[^carrier-manifest]: `../../packages/pluginfinity/package.json`
