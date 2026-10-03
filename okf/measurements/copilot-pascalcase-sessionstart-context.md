---
type: Measurement
title: Copilot honours flat additionalContext from a PascalCase SessionStart hook, 2026-10-03
description: A Copilot CLI 1.0.91 plugin hook declared under the PascalCase SessionStart name, printing a flat additionalContext object, reached the model's context.
tags:
  - portability
  - github
status: draft
stale_after: 2027-01-01T00:00:00Z
justifies: ../decisions/claude-code-names-are-the-source-vocabulary.md
sources:
  - id: sessionstart-run
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-03T00:00:00Z
    title: A run of effected's pluginfinity build under Copilot CLI 1.0.91, made in the session the owner directed
  - id: copilot-hooks-reference
    resource: https://docs.github.com/en/copilot/reference/hooks-configuration
    title: GitHub Copilot hooks configuration reference
generated:
  by: okfit/claude-code
  at: 2026-10-03T01:28:45Z
  body_sha256: 7065cd7473e048dd99b7a73c7cd4d2b8c1b0744772b336bc0c05fc47f2ba45bf
---

# Copilot honours flat additionalContext from a PascalCase SessionStart hook, 2026-10-03

## Method

Copilot lists `additionalContext` as the output it honours for both `sessionStart` and `SessionStart`, and says a PascalCase name selects the VS Code compatible payload, without saying which output shape that name expects.[^copilot-hooks-reference] effected's plugin, built by pluginfinity, declares one hook in `com.github.copilot/hooks/hooks.json`: event `SessionStart`, `bash` set to `bash "${PLUGIN_ROOT}/hooks/session-start/orientation.copilot.sh"`, `timeoutSec` 5. The script prints a flat `{ "additionalContext": … }` object, not Claude Code's `hookSpecificOutput` wrapper.

The repository owner ran Copilot CLI 1.0.91 with `--plugin-dir builds/copilot -p` and a prompt asking it to quote the first sentence of any context a SessionStart hook gave it, or reply NONE.[^sessionstart-run]

## Results

Copilot quoted the briefing's first sentence verbatim: `The "effected" plugin is loaded: Effect v4 development skills plus three specialist subagents, distilled from the @effected packages and the official Effect-TS v4 guides.`[^sessionstart-run]

## What this rules in and out

- The Copilot target can keep the PascalCase `SessionStart` name; a hook printing flat `additionalContext` works under it.
- It does not show whether Claude Code's `hookSpecificOutput.additionalContext` wrapper is also honoured under that name, so one script printing the same output on both hosts is still unmeasured.

[^sessionstart-run]: conversation with the repository owner, 2026-10-03
[^copilot-hooks-reference]: <https://docs.github.com/en/copilot/reference/hooks-configuration>
