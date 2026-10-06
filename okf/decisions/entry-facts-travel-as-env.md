---
type: Decision
title: Facts about a hook entry travel to its script as environment variables
description: The build gives each hook entry its event, its fail policy and, where the host ignores the matcher, its matcher through PLUGINFINITY_* variables, in exec-form env on Claude Code script entries and the env field on Copilot.
status: draft
tags:
  - architecture
  - portability
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-06T00:00:00Z
  - id: engine-hooks
    resource: ../../packages/engine/src/hooks.ts
    title: entryEnv, hookExec, hookCommand and the renderers
  - id: hook-lib
    resource: ../../packages/engine/hook-lib/hook.sh
    title: The hook library reading the variables
  - id: errors
    resource: ../../packages/engine/src/errors.ts
    title: HookScriptInvalid and the equals-in-path problem
  - id: core-target
    resource: ../../packages/core/src/target.ts
    title: matcherIgnored in the hooks part
generated:
  by: okfit/claude-code
  at: 2026-10-06T21:43:13Z
  body_sha256: 60940a059b2c5549f0417f758a63386dfbdadedda108da48f982ad24064b7b8c
---

# Facts about a hook entry travel to its script as environment variables

## Context

A Copilot payload is camelCase and carries no `hook_event_name`, so a script cannot tell its event from its input. A hook entry's `failClosed` choice and its matcher were facts the config held and the script could not see. Copilot also ignores the matcher on `SessionStart`, `SessionEnd` and `SubagentStop`, so an entry written for one matcher would fire for all of them.[^core-target] The owner directed that the build hand these facts to the script.[^owner-direction]

## Decision

- Every hook entry runs with `PLUGINFINITY_EVENT`, the Claude event name. An entry that sets `failClosed: true` also gets `PLUGINFINITY_FAIL_CLOSED=1`, which the library reads before any script code runs, so a crash before `hook_fail_closed` still denies; the default stays [failing open](hooks-fail-open.md). On an event the host ignores the matcher for, the build drops the host `matcher` key and passes the matcher as `PLUGINFINITY_MATCHER`; the library then applies it at run time.[^engine-hooks][^hook-lib]
- The carriers differ by host. A Claude Code `script` entry renders in exec form, `env K=V… bash <path> …`, so no shell parses the command. A Claude Code `command` entry gets `export K='V';` before the command. Copilot carries the facts only in the entry's `env` field and never as a shell prefix. Values in any shell-form string are always single-quoted; exec-form arguments are raw `K=V`.
- Under `scripts.invoke` `"exec"` a hook script path containing `=` is a build error, `HookScriptInvalid` with the problem `equals-in-path`, because `env` would read the path as a variable assignment.[^errors] Under `"bash"` the path follows `bash` and is harmless.
- Run-time matcher enforcement covers only an entry whose script sources `hook.sh`. A plain `command` entry on Copilot gets the variable but nothing reads it, although the `hook-matcher-runtime` build note says the matcher moved.

## Consequences

- A script reads its event with `hook_event` on both hosts, and `failClosed` is a config field, not a call every script must remember.
- Authors cannot put `=` in a script path under `exec` invocation.
- The matcher note over-promises for a non-library command entry on Copilot. Writing it as a library script is the fix.

## Alternatives rejected

- **Derive the event from the payload.** Copilot's payload does not carry it.
- **A shell prefix on Copilot.** Copilot's `env` field is the documented channel, and a prefix would need a shell the entry does not otherwise use.

[^owner-direction]: conversation with the repository owner, 2026-10-06
[^engine-hooks]: `../../packages/engine/src/hooks.ts`
[^hook-lib]: `../../packages/engine/hook-lib/hook.sh`
[^errors]: `../../packages/engine/src/errors.ts`
[^core-target]: `../../packages/core/src/target.ts`
