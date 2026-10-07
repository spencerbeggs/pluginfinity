---
type: Decision
title: Session env is declared in the config and resolved once at SessionStart
description: A plugin declares its session variables and their defaults in an env config block; the build generates env.sh and a SessionStart runner that resolve them once through one precedence chain, and every hook, skill script and monitor on both hosts reads the same values.
status: draft
tags:
  - architecture
  - portability
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
    title: Declare the variables and defaults in the config and generate the sourcing script and a re-source helper; implement .env and .env.local loading; approved the precedence chain, the startup to startup|new mapping and the parallel-SessionStart ruling
  - id: core-env
    resource: ../../packages/core/src/env.ts
    title: EnvConfig, EnvVar and the reserved names
  - id: engine-env
    resource: ../../packages/engine/src/env.ts
    title: renderEnvLib, the runner entry, withEnvRunner and the env notes
  - id: env-lib
    resource: ../../packages/engine/env-lib/env.sh
    title: The env library and its precedence chain
  - id: env-run
    resource: ../../packages/engine/env-lib/env-run.sh
    title: The SessionStart runner
  - id: hook-lib
    resource: ../../packages/engine/hook-lib/hook.sh
    title: hook_env_set and the env start before every hook body
  - id: engine-hooks
    resource: ../../packages/engine/src/hooks.ts
    title: sessionStartMatcher, the startup to startup|new widening
  - id: probes
    resource: ../measurements/host-runtime-probes-2026-10-07.md
    title: The CLAUDE_ENV_FILE reach and Copilot's SessionStart source
  - id: binary-plugin
    resource: https://github.com/spencerbeggs/claude-binary-plugin
    title: The prior art, whose .env loading takes the first file that exists
generated:
  by: okfit/claude-code
  at: 2026-10-07T06:53:05Z
  body_sha256: dcae0a9e9534f17453b4949427fb3c86f31a736d591241e231dd80bda2767672
---

# Session env is declared in the config and resolved once at SessionStart

## Context

The downstream plugin silk kept per-session values (a detected package manager, a data directory) with a hand-written `source-session-env.sh` that every hook and skill script had to source, and it answered with a request for library-owned session env that behaves the same on both hosts. The owner directed the shape: declare the variables and their defaults in the config, and generate the sourcing script and a re-source helper, with `.env` and `.env.local` loading implemented too.[^owner-direction] Claude Code has `CLAUDE_ENV_FILE` for the model's shell, but a live probe showed its exports reach the Bash tool and none of the later hooks, and Copilot has no known equivalent, so the host cannot be the carrier for hooks.[^probes]

## Decision

- **An `env` config block** declares `vars` (each with an optional `default`, default `""`, and a `description`), an optional `prefix` every name must start with, and an optional plugin-relative `setup` script. Names are `[A-Z_][A-Z0-9_]*`; `PATH`, `IFS`, `HOME`, `PWD` and names starting `PLUGINFINITY_` or `_PF_` are reserved, and a missing `setup` script fails the build. Values are strings, and it is plugin-wide with no per-target override.[^core-env]
- **One precedence chain**, lowest first: the config default, the `setup` script's stdout, `<project>/.env`, `<project>/.env.local`, the ambient environment, then `hook_env_set` at run time. The owner approved this order.[^owner-direction] Only declared names are read from `.env` files, which are parsed, never sourced: `KEY=value` or `export KEY=value`, quotes stripped, nothing expanded.[^env-lib]
- **Resolved once.** A generated SessionStart entry runs `env-run.sh`, which evaluates the first five rungs once and writes the resolved values under `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/session/<session id>/`, with a project pointer so a script with no session id finds the latest session. Readers take that file as authoritative, so a value Claude passes into a later process natively is never mistaken for an ambient override; a reader with no file resolves live.[^env-run]
- **Readers.** The hook library sources `env.sh` before every hook body, so a hook sees the values with no code. A skill script or monitor sources `lib/pluginfinity/env.sh` with one documented line.[^hook-lib]
- **`hook_env_set NAME value`** works only in producer events (SessionStart, Setup, CwdChanged, FileChanged) and for declared names, always returns 0 (a refusal is a log line, so it never aborts a `set -e` script), and appends to `CLAUDE_ENV_FILE` on Claude so the model's shell sees it. `hook_supports env-shell` reports whether the host does that; Copilot gets an `env-shell-unsupported` build note, because there a skill script must source `env.sh`.[^engine-env]
- **Setup** runs once per SessionStart under `bash` in the project directory, is bounded at 10 s, keeps its valid lines on a non-zero exit, and is skipped with a log line when there is no project. The runner's own entry has a 15 s timeout so it outlives setup.
- **Claude runs an event's hooks in parallel**, so the runner being first in order does not make it first to finish. A SessionStart reader with no values file waits up to 3 s for the runner's done marker and then resolves live; other events never wait. A SessionStart entry with a `timeout` under 5 s gets an `env-wait-timeout` note. The owner approved this ruling.[^owner-direction]
- **Copilot reports a fresh session as `new`**, where Claude says `startup`, so the build widens a SessionStart matcher that holds `startup` to also hold `new` (`hook-matcher-widened`) and notes a regex matcher it cannot widen (`hook-matcher-regex`). The owner approved the mapping.[^owner-direction][^engine-hooks]
- Everything fails open: no hook ever fails because of env.

## Alternatives considered

- **Static defaults only** (no setup, no files). Rejected: silk's value is detected at session start, and a project's own `.env` is where users already put overrides.
- **A declared producer only (a setup script), or declarations only.** Both were weighed; declarations plus an optional setup script cover a plugin with fixed defaults, one with detected values, and both, with one chain, so the block takes both.
- **The binary plugin's `.env` order, which takes the first `.env` file that exists.** Rejected: `.env.local` must layer over `.env`, as in other tools, rather than replace it.[^binary-plugin]
- **Relying on `CLAUDE_ENV_FILE` to carry values to hooks.** Rejected by measurement: its exports did not reach PreToolUse, PostToolUse, Stop, SubagentStart or UserPromptSubmit, and a sibling file beside it reached nothing. The library's own `env.sh` carries values to hooks on both hosts, and `CLAUDE_ENV_FILE` serves only the Bash tool.[^probes]

## Consequences

- A plugin gets the same values in hooks and scripts on both hosts, and the hand-written sourcing script and its exports go away; the bats helper seeds session values with `--session-env` and models `CLAUDE_ENV_FILE` with `--env-file`.
- Values changed after SessionStart by anything but `hook_env_set` are not seen by later hooks; a resumed session gets a new session id and a fresh file, so earlier `hook_env_set` values are not carried over.
- Whether Copilot has an env-file mechanism is unmeasured (the hook-environment probe was skipped by the old matcher); the design assumes none, and `envShell` in the Copilot target description is empty until a run says otherwise.

[^owner-direction]: conversation with the repository owner, 2026-10-07
[^core-env]: `../../packages/core/src/env.ts`
[^engine-env]: `../../packages/engine/src/env.ts`
[^env-lib]: `../../packages/engine/env-lib/env.sh`
[^env-run]: `../../packages/engine/env-lib/env-run.sh`
[^hook-lib]: `../../packages/engine/hook-lib/hook.sh`
[^engine-hooks]: `../../packages/engine/src/hooks.ts`
[^probes]: [Host runtime probes, 2026-10-07](../measurements/host-runtime-probes-2026-10-07.md)
[^binary-plugin]: `https://github.com/spencerbeggs/claude-binary-plugin`
