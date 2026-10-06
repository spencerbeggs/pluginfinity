---
type: Decision
title: Build notes also report hook matchers, ignored hook output and omitted monitors
description: The info-level build notes grow from four kinds to seven, adding hook-matcher-runtime, hook-output-ignored and monitor-omitted, so a hook or monitor a host cannot honour as written is reported instead of silently weaker.
status: draft
supersedes: build-notes-report-dropped-fields.md
tags:
  - dx
  - portability
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-06T00:00:00Z
  - id: notes
    resource: ../../packages/engine/src/notes.ts
    title: BuildNote, BUILD_NOTE_KINDS and sortNotes
  - id: hook-output
    resource: ../../packages/engine/src/hook-output.ts
    title: The hook-output-ignored scan
  - id: monitors
    resource: ../../packages/engine/src/monitors.ts
    title: Where monitor-omitted notes are raised
generated:
  by: okfit/claude-code
  at: 2026-10-06T21:43:13Z
  body_sha256: c4217f3eda1de722967978bf8ffb48ae6f24359828e77862a0f1138ca034dcb6
---

# Build notes also report hook matchers, ignored hook output and omitted monitors

## Context

[The earlier decision](build-notes-report-dropped-fields.md) made every drop visible with four note kinds. Round 1 added three things a host can honour only partly: a hook matcher the host ignores, a hook script that emits output the host discards, and a monitor on a host with none. Each would otherwise ship as a weaker plugin with no report.[^owner-direction]

## Decision

Everything in the earlier decision still holds: a note is `{target, path, kind, name}`, never fails a command, is de-duplicated, and prints as one line per component. The kinds are now seven, in their sort and print order:[^notes]

- `dropped`, `degraded` and `tool-dropped`, as before.
- `hook-matcher-runtime`: an event whose matcher the target ignores and whose entries set a matcher, so the build moved the matcher into the hook library. The path is `config` and the name is the event. The note is raised for the event, but only an entry whose script sources `hook.sh` is enforced at run time; a plain `command` entry gets no enforcement.
- `hook-output-ignored`: a `script` entry that calls `hook_context` or `hook_system_message` on an event where the host ignores that output, such as any `hook_system_message` on Copilot, which honours none. The path is the script and the name is `<event>:<helper>`. The scan is best effort: comments are stripped, heredocs are not modelled, and an event only the target owns is not scanned.[^hook-output]
- `hook-omitted`, as before.
- `monitor-omitted`: a monitor on a target with no monitors. The path is `config` and the name is the monitor.[^monitors]

## Consequences

- Authors see matcher moves and ignored output on the first build for each host.
- `hook-output-ignored` can miss a helper called through a variable or a sourced file, so a clean build is not proof that every output lands.
- Both the `build` and `validate` human lines and their JSON `notes` arrays carry the new kinds, with no change to exit codes.

## Alternatives rejected

- **Fail the build on ignored output.** A script that targets two hosts legitimately emits output only one honours.
- **Leave the new kinds to the host-specific docs.** That repeats the silent drop the first decision removed.

[^owner-direction]: conversation with the repository owner, 2026-10-06
[^notes]: `../../packages/engine/src/notes.ts`
[^hook-output]: `../../packages/engine/src/hook-output.ts`
[^monitors]: `../../packages/engine/src/monitors.ts`
