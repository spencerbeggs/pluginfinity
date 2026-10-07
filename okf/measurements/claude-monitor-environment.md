---
type: Measurement
title: Claude Code monitor environment, 2026-10-07
description: What Claude Code 2.1.292 gives a plugin monitor for start time, working directory, environment and session scoping, and that an on-skill-invoke monitor starts only under the plugin-qualified skill name, on a slash command or a model dispatch, measured with the dogfood monitors.
tags:
  - portability
status: draft
stale_after: 2027-01-07T00:00:00Z
justifies: ../decisions/monitors-are-a-component.md
sources:
  - id: monitor-live-run
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
    title: Live runs by the owner on 2026-10-06 and 2026-10-07 under Claude Code 2.1.292, loading the dogfood and companion Claude builds with PLUGINFINITY_DEBUG=1
  - id: heartbeat-monitor
    resource: ../../plugins/dogfood/monitors/heartbeat.sh
    title: The dogfood heartbeat monitor, which logs its environment with monitor_debug
  - id: monitor-lib
    resource: ../../packages/engine/monitor-lib/monitor.sh
    title: monitor_once and monitor_project_dir
  - id: debug-log
    resource: the dogfood plugin debug.log under the XDG state directory, pluginfinity/pluginfinity-dogfood/debug.log
    title: The monitor's own debug log from the runs
  - id: systems-findings
    resource: savvy-web/systems round-1 findings, 2026-10-07
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
    title: The downstream's findings mail, from lsof and ps eww on running monitors in three sessions under Claude Code 2.1.291 and 2.1.292
  - id: cc-plugins-reference
    resource: https://code.claude.com/docs/en/plugins-reference.md
    title: Plugin manifest reference, monitors
generated:
  by: okfit/claude-code
  at: 2026-10-07T02:45:11Z
  body_sha256: 49e2ec7f3a05f1f98007e0771b7b64f72878c355a570085f676f0b869b4f1bfa
---

# Claude Code monitor environment, 2026-10-07

## Method

`pnpm claude:debug` loaded `plugins/dogfood/builds/claude` and `plugins/pluginfinity/builds/claude` under Claude Code 2.1.292 with `PLUGINFINITY_DEBUG=1`. The dogfood `heartbeat` monitor logged its working directory and environment with `monitor_debug`.[^heartbeat-monitor] The evidence is the monitor's `debug.log` and the session transcripts.[^debug-log][^monitor-live-run]

## Results

| Observation | Result |
| :-- | :-- |
| Start | An `always` monitor started at session start in each of four sessions (23:32, 23:33, 23:34 and 23:35 UTC), once per session |
| Working directory | The project directory the session ran in |
| `CLAUDE_PROJECT_DIR` | Not set in the monitor's environment |
| Inherited environment | The launching shell's environment (`PLUGINFINITY_DEBUG=1` was present), plus `PLUGINFINITY_MONITOR=heartbeat` from the generated command prefix |
| `CLAUDE_SESSION_ID` | Not set, so `monitor_once` (then keyed on it) fell back to `$PPID`; one marker file per session appeared (`monitor/heartbeat/<pid>.heartbeat`)[^monitor-lib] |
| Output | The monitor's one stdout line reached the model as a task-notification, `Monitor event: "<description>"`, with the line as the event text |
| `on-skill-invoke:hook-eval` (bare name) | Never started, in any of six sessions: the slash command `/pluginfinity-dogfood:hook-eval` (23:44 and 23:47 UTC on 2026-10-06) and the others measured on 2026-10-07 |
| `on-skill-invoke:pluginfinity-dogfood:hook-eval` (qualified name) | Started and notified in both sessions measured on 2026-10-07 (00:10 and 00:12 UTC): one where the model dispatched the skill with the Skill tool (`{"skill":"pluginfinity-dogfood:hook-eval"}`), one with the slash command |
| Independent measurement | `lsof` and `ps eww` on running monitors in three sessions under Claude Code 2.1.291 and 2.1.292 (2026-10-06) found the working directory is the project directory; `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_SESSION_ID` are absent; and `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID`, `CLAUDE_CODE_CHILD_SESSION=1` and `CLAUDE_CODE_ENTRYPOINT=cli` are present[^systems-findings] |
| Claude's own debug log | `~/.claude/debug/<session>.txt` logs no monitor start lines for any plugin |

## What this rules in and out

- A monitor starts in the project directory, so a relative path resolves there; `monitor_project_dir` reaches the project through its git-root fallback because `CLAUDE_PROJECT_DIR` is unset.
- A monitor script cannot rely on `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` or `CLAUDE_SESSION_ID`. Both measurements show `CLAUDE_CODE_SESSION_ID`, so `monitor_once` now keys on it first, then `CLAUDE_SESSION_ID`, then the monitor's parent pid.
- A monitor sees the user's shell environment, so a debug switch set before `claude` reaches it.
- Claude matches `on-skill-invoke:` against the plugin-qualified skill name `<plugin>:<skill>`. Both dispatch routes, a model Skill-tool call and a user slash command, start the monitor under that name, and the bare name never matches. The plugins reference says such a monitor starts the first time the named skill in the plugin is dispatched.[^cc-plugins-reference] The build therefore writes the qualified name from the bare one an author writes.
- The 2026-10-07 runs put two monitors on one script, `skill-watch` (bare) and `skill-watch-qualified`, so the same session showed that only the qualified one started.
- Only the dogfood heartbeat was run. No host other than Claude Code has monitors, and nothing here covers restart, `/reload-plugins` or a marketplace install.

[^monitor-live-run]: conversation with the repository owner, 2026-10-06
[^heartbeat-monitor]: `../../plugins/dogfood/monitors/heartbeat.sh`
[^monitor-lib]: `../../packages/engine/monitor-lib/monitor.sh`
[^debug-log]: `~/.local/state/pluginfinity/pluginfinity-dogfood/debug.log`
[^systems-findings]: savvy-web/systems round-1 findings, 2026-10-07
[^cc-plugins-reference]: <https://code.claude.com/docs/en/plugins-reference.md>
