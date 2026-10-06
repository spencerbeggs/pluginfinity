---
type: Measurement
title: Claude Code monitor environment, 2026-10-06
description: What Claude Code 2.1.292 gives a plugin monitor for start time, working directory, environment and session scoping, and that a slash-command invocation does not start an on-skill-invoke monitor, measured with the dogfood heartbeat monitor.
tags:
  - portability
status: draft
stale_after: 2027-01-06T00:00:00Z
justifies: ../decisions/monitors-are-a-component.md
sources:
  - id: monitor-live-run
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-06T00:00:00Z
    title: Live runs by the owner on 2026-10-06 under Claude Code 2.1.292, loading the dogfood and companion Claude builds with PLUGINFINITY_DEBUG=1
  - id: heartbeat-monitor
    resource: ../../plugins/dogfood/monitors/heartbeat.sh
    title: The dogfood heartbeat monitor, which logs its environment with monitor_debug
  - id: monitor-lib
    resource: ../../packages/engine/monitor-lib/monitor.sh
    title: monitor_once and monitor_project_dir
  - id: debug-log
    resource: the dogfood plugin debug.log under the XDG state directory, pluginfinity/pluginfinity-dogfood/debug.log
    title: The monitor's own debug log from the runs
  - id: cc-plugins-reference
    resource: https://code.claude.com/docs/en/plugins-reference.md
    title: Plugin manifest reference, monitors
generated:
  by: okfit/claude-code
  at: 2026-10-06T23:52:26Z
  body_sha256: 7946160a6bd510060a1adf1e03c27a8ceddad5bcaae12736e330b081a236fb68
---

# Claude Code monitor environment, 2026-10-06

## Method

`pnpm claude:debug` loaded `plugins/dogfood/builds/claude` and `plugins/pluginfinity/builds/claude` under Claude Code 2.1.292 with `PLUGINFINITY_DEBUG=1`. The dogfood `heartbeat` monitor logged its working directory and environment with `monitor_debug`.[^heartbeat-monitor] The evidence is the monitor's `debug.log` and the session transcripts.[^debug-log][^monitor-live-run]

## Results

| Observation | Result |
| :-- | :-- |
| Start | An `always` monitor started at session start in each of four sessions (23:32, 23:33, 23:34 and 23:35 UTC), once per session |
| Working directory | The project directory the session ran in |
| `CLAUDE_PROJECT_DIR` | Not set in the monitor's environment |
| Inherited environment | The launching shell's environment (`PLUGINFINITY_DEBUG=1` was present), plus `PLUGINFINITY_MONITOR=heartbeat` from the generated command prefix |
| `CLAUDE_SESSION_ID` | Not set, so `monitor_once` keyed its marker by `$PPID`; one marker file per session appeared (`monitor/heartbeat/<pid>.heartbeat`)[^monitor-lib] |
| Output | The monitor's one stdout line reached the model as a task-notification, `Monitor event: "<description>"`, with the line as the event text |
| `on-skill-invoke:hook-eval` after the slash command `/pluginfinity-dogfood:hook-eval` | The monitor did not start, in two sessions (23:44 and 23:47 UTC): no `started` debug line and no state directory |
| Claude's own debug log | `~/.claude/debug/<session>.txt` logs no monitor start lines for any plugin |

## What this rules in and out

- A monitor starts in the project directory, so a relative path resolves there; `monitor_project_dir` reaches the project through its git-root fallback because `CLAUDE_PROJECT_DIR` is unset.
- A monitor script cannot rely on `CLAUDE_PROJECT_DIR` or `CLAUDE_SESSION_ID`; `monitor_once` scopes by the monitor's parent pid, which is stable for one session.
- A monitor sees the user's shell environment, so a debug switch set before `claude` reaches it.
- A user slash-command invocation does not start an `on-skill-invoke` monitor with the bare skill name. The plugins reference says such a monitor starts the first time the named skill in the plugin is dispatched.[^cc-plugins-reference] Whether a model Skill-tool dispatch starts it, and whether the `<plugin>:<skill>` form matches, are not measured.
- Only the dogfood heartbeat was run. No host other than Claude Code has monitors, and nothing here covers restart, `/reload-plugins` or a marketplace install.

[^monitor-live-run]: conversation with the repository owner, 2026-10-06
[^heartbeat-monitor]: `../../plugins/dogfood/monitors/heartbeat.sh`
[^monitor-lib]: `../../packages/engine/monitor-lib/monitor.sh`
[^debug-log]: `~/.local/state/pluginfinity/pluginfinity-dogfood/debug.log`
[^cc-plugins-reference]: <https://code.claude.com/docs/en/plugins-reference.md>
