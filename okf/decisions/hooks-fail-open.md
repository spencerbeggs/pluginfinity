---
type: Decision
title: Hooks fail open on both hosts
description: A hook script that fails exits 0 with no response on Claude Code and Copilot alike, unless it opted into failing closed with hook_fail_closed.
status: draft
tags:
  - portability
  - security
sources:
  - id: hook-library-spec
    resource: ../../docs/superpowers/specs/2026-10-03-hook-library-design.md
    title: Hook library design spec
    last_modified: 2026-10-03T00:00:00Z
  - id: cc-hooks
    resource: https://code.claude.com/docs/en/hooks.md
    title: Claude Code hooks reference
    last_modified: 2026-10-03T00:00:00Z
  - id: copilot-hooks-reference
    resource: https://docs.github.com/en/copilot/reference/hooks-configuration
    title: GitHub Copilot hooks reference
    last_modified: 2026-10-03T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-03T21:06:07Z
  body_sha256: 6d4afc0d271c08db6ebb8dda0f2007315a7f40cbab903ffef8c67e1648c98187
---

# Hooks fail open on both hosts

## Context

The two hosts treat a failing hook differently. On Copilot a command `preToolUse` hook fails closed: a crash or any non-zero exit, including exit `2`, denies the tool call, even if the hook's JSON said `allow`.[^copilot-hooks-reference] On Claude Code only exit `2` blocks, and any other non-zero exit is a non-blocking error, so the tool call proceeds.[^cc-hooks] Exit `2` on a stop event blocks on Claude Code and is only a warning on Copilot.[^copilot-hooks-reference][^cc-hooks] A script that crashes, aborts under `set -e`, or runs without `jq` would therefore deny tools on one host and not the other. The library needs one behaviour ([hook library injection](hook-library-is-build-injected.md)), and the design spec fixes it as the default.[^hook-library-spec]

## Decision

- The library installs a crash trap. A hook script that fails, whether by an unexpected non-zero exit, a `set -e` abort or a missing `jq`, writes nothing (no `{}`), exits `0`, and records the failure in the hook error log, on both hosts.
- A script that wants a failure to deny calls `hook_fail_closed`. The trap then denies on a pre-tool event and blocks on events where block is supported, instead of writing nothing.
- Timeouts are not covered by the trap. Copilot treats a timeout as fail-open for every event, and Claude Code lets a timed-out `PreToolUse` command hook through.[^copilot-hooks-reference][^cc-hooks]

## Consequences

- A broken hook never stops a user's work on either host. The cost is that a broken policy hook lets the call through, so a gating hook must opt in with `hook_fail_closed` and be tested.
- The Copilot-specific denial on a crash is removed rather than documented away.
- The error log is the only signal of a failed hook, so the library writes it on every trapped failure.

[^hook-library-spec]: `../../docs/superpowers/specs/2026-10-03-hook-library-design.md`
[^cc-hooks]: <https://code.claude.com/docs/en/hooks.md>
[^copilot-hooks-reference]: <https://docs.github.com/en/copilot/reference/hooks-configuration>
