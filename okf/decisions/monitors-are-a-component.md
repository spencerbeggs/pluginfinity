---
type: Decision
title: Monitors are a first-class component
description: A plugin declares background monitors in the config, the build writes Claude Code's monitors file and ships their scripts and the monitor library, and a host with no monitors drops them with a monitor-omitted note.
status: draft
tags:
  - architecture
  - portability
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-06T00:00:00Z
  - id: core-monitors
    resource: ../../packages/core/src/monitors.ts
    title: MonitorEntry, MonitorWhen and Monitors
  - id: engine-monitors
    resource: ../../packages/engine/src/monitors.ts
    title: targetMonitors and renderMonitors
  - id: monitor-lib
    resource: ../../packages/engine/monitor-lib/monitor.sh
    title: The POSIX sh monitor library
  - id: cc-plugin-format
    resource: ../references/claude-code-plugin-format.md
    title: Claude Code plugin format, monitors
generated:
  by: okfit/claude-code
  at: 2026-10-06T21:45:51Z
  body_sha256: 59d12056073c6fbcae3acc26b9113362f9772e9b850a1741287cba081ab0575e
---

# Monitors are a first-class component

## Context

Claude Code runs a plugin's background monitors from `monitors/monitors.json` and delivers each stdout line to the model.[^cc-plugin-format] The first release listed monitors as out of scope ([source model](../models/plugin-source-model.md)). A plugin that needed one had to hand-write the file, which the build would then clash with or never ship. The owner said: "We should build a first-class monitors solution though, these would be dropped in copilot obviously, but a first-class way to implement them would be helpful."[^owner-direction]

## Decision

- `monitors` is a base config key and a per-target key, a record of kebab-case names to an entry with exactly one of `script` or `command`, a required `description`, and an optional `when`: `"always"` (the default) or `on-skill-invoke:<skill>`. A target's monitor replaces the base monitor of that name.[^core-monitors]
- A target description's `monitors` part is a `{path, root}` placement or `unresolved`. Claude Code's is `monitors/monitors.json` with `${CLAUDE_PLUGIN_ROOT}`; Copilot's is unresolved, since Copilot CLI has no monitors.
- The build writes the file as an array of `{name, command, description, when?}`, each command carrying `PLUGINFINITY_MONITOR=<name>`, which the monitor library logs under.[^engine-monitors] A target without monitors drops each one with a `monitor-omitted` [build note](build-notes-cover-hooks-and-monitors.md) and ships neither the file nor the scripts.
- A source `monitors/monitors.json` is a build error, since that path is generated. A monitor script ships only to a target that builds monitors, even from under `hooks/`.
- A target with monitors gets `lib/pluginfinity/monitor.sh`, a POSIX `sh` library with `monitor_every`, `monitor_notify`, `monitor_log` and the rest, which sources the [shared log library](one-logging-standard.md).[^monitor-lib] Under `scripts.invoke` `"exec"` a monitor script path containing `=` is still allowed, because a monitor runs as a shell string, unlike a hook script.

## Consequences

- A monitor is built, checked and tested like a hook: `run_monitor` in the bats helper runs a built monitor's command.
- Two behaviours are not yet measured on a live host: the working directory and environment a Claude monitor starts with, and whether `when: on-skill-invoke:<skill>` matches the bare skill name or `<plugin>:<skill>`. They stay open until a human live run records them as a measurement.
- A skill's `monitor_notify` call inside a subshell cannot tell the loop that stdout closed, so a monitor calls it directly.

## Alternatives rejected

- **A Node or JS helper for monitors.** Deferred: built plugins carry markdown, JSON and bash only ([decision](plugins-carry-no-node-dependencies.md)).

[^owner-direction]: conversation with the repository owner, 2026-10-06
[^core-monitors]: `../../packages/core/src/monitors.ts`
[^engine-monitors]: `../../packages/engine/src/monitors.ts`
[^monitor-lib]: `../../packages/engine/monitor-lib/monitor.sh`
[^cc-plugin-format]: `../references/claude-code-plugin-format.md`
