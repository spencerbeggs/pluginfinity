---
type: Interface
kind: cli
title: The pluginfinity command line
description: "The pluginfinity bin's commands, flags, audiences and exit codes: 0 for success, 1 for a finding such as a config error, 64 for a usage error, with stdout reserved for structured output."
resource: ../../packages/cli/src/cli/program.ts
status: draft
tags:
  - dx
  - ci
sources:
  - id: program
    resource: ../../packages/cli/src/cli/program.ts
    title: The root command and its subcommands
  - id: run
    resource: ../../packages/cli/src/cli/run.ts
    title: CliRuntime.main wiring, environment variables and the version line
  - id: shared
    resource: ../../packages/cli/src/commands/shared.ts
    title: The shared path, target, all and config inputs
  - id: render-config-error
    resource: ../../packages/cli/src/render/config-error.ts
    title: How a config error is reported and why it exits 1
  - id: render-build
    resource: ../../packages/cli/src/render/build.ts
    title: The build and validate lines, their note lines and their JSON
  - id: logs
    resource: ../../packages/cli/src/commands/logs.ts
    title: The logs command, plugin selection and the bounded follow
  - id: render-logs
    resource: ../../packages/cli/src/render/logs.ts
    title: The logs sections for people and the JSON for agents
  - id: render-doctor
    resource: ../../packages/cli/src/render/doctor.ts
    title: The doctor checklist and its JSON form
  - id: commands-test
    resource: ../../packages/cli/__test__/commands.test.ts
    title: The usage-error and NotImplemented exit-code cases
generated:
  by: okfit/claude-code
  at: 2026-10-07T03:22:43Z
  body_sha256: 65ad2d163723d21cebbed7757f52cf5c06aadabb6133c9422c7290acba0711bf
---

# The pluginfinity command line

The promise the `pluginfinity` bin makes to the people, agents and CI jobs that run it. The [CLI module](../modules/cli.md) implements it over the [engine](../modules/engine.md). Several commands are still stubs, and their flags are in place so scripts and docs can be written against them now.

## Commands

| Command | What it does today |
| :-- | :-- |
| `pluginfinity init [dir]` | Stub. Takes `--layout root\|plugin\|plugins`, `--name`, `--pm pnpm\|npm\|yarn\|bun`, `--target`, `--no-changesets`, `--no-ci` and `--yes`, checks them, then fails with `NotImplemented`. |
| `pluginfinity plugin add <name>` | Stub. Takes `--target` and `--dir`, checks the name, then fails with `NotImplemented`. A bare `pluginfinity plugin` prints the group's help. |
| `pluginfinity build [path]` | Renders each enabled target's manifest, hooks, skills, agents and MCP and LSP server config, with the shipped hook scripts, monitors, server launchers, `files` entries, skill files and the injected hook, server, log and monitor libraries, into `builds/<id>/` beside the config, writing only files that differ, and prints what it added, changed and removed, with the build's notes: what each target dropped, degraded or omitted ([decision](../decisions/build-notes-cover-hooks-and-monitors.md)). Takes `--target`, `--all`, `--config` and `--check` (rebuild in memory, compare with `builds/`, and fail with `BuildStale` on any difference, writing nothing). |
| `pluginfinity validate [path]` | Requires current builds (`BuildStale` otherwise), then runs each host's check: `claude plugin validate` on `builds/claude/`, and a `copilot --plugin-dir` plugin listing that must load `builds/copilot/` under its manifest name and version (`HostRejected` otherwise). Takes `--target`, `--all`, `--config` and `--no-host` (skip the host CLIs). |
| `pluginfinity doctor [path]` | Works. Reports on the runtime, the host CLIs, the tools and the config. Takes `--all`, `--config` and `--strict`. |
| `pluginfinity logs` | Works. Shows the logs plugins write under `${XDG_STATE_HOME:-$HOME/.local/state}/pluginfinity/<plugin>/` ([the standard](../decisions/one-logging-standard.md)). Takes `--plugin <name>` (repeatable), `--debug`, `--follow` (`-f`) and `--lines <n>` (`-n`, default 50). |

The commands that read a config share their inputs:[^shared]

- `[path]` is where config discovery starts, the launch directory by default. A relative path resolves against the launch directory, and a `[path]` that does not exist is a usage error, so a typo never falls through to a config further up the tree.
- `--target <id>` is repeatable and limited to the known ids (`claude`, `copilot`). With none given, every enabled target is used. Naming a target the config does not enable is a finding (`TargetNotEnabled`).
- `--all` selects every config below `[path]`, and `--config <file>` names one file with no discovery. Giving both is a usage error.

`logs` takes no `[path]`; discovery starts at the launch directory.[^logs] The plugins it reads are, in order: each `--plugin <name>`; else the names the nearest config's enabled targets publish under (the config's `name` and each target's own `name`, since each target logs under its own); else, when no config is found, every directory under the state directory. A config that is found but broken is a finding, not a fallback. It shows `error.log`, or `debug.log` with `--debug` (one file per plugin, never interleaved), the last `--lines` complete lines of each. A file that does not exist says so, and for `debug.log` says to set `PLUGINFINITY_DEBUG=1`. `--follow` then keeps printing appended lines, checked twice a second and restarted from the top of a truncated file, until interrupted; Ctrl-C ends it with exit 0, as `tail -f` does.

The root command shares `--human`, `--agent` and `--ci` with every subcommand and provides `--help`, `--version` and `--log-level`.[^program] A bare `pluginfinity` prints help.

## Exit codes

- **0**: success. `doctor` exits 0 even when a check fails, unless `--strict` is given. `logs` exits 0 when there is nothing to show, including a state directory that does not exist or a plugin that has not logged: a query that matches nothing succeeds, and a missing log means nothing was logged.
- **1**: a finding. Every config failure (`ConfigNotFound`, `ConfigAmbiguous`, `ConfigLoadFailed`, `ConfigInvalid`, `UnknownTarget`, `TargetNotEnabled`) is reported as a finding and exits 1.[^render-config-error] So is every build failure (`PackageVersionMissing`, `HookEventUnsupported`, `HookScriptInvalid`, `ShippedFileInvalid`, `PathConflict`, `ComponentsInvalid`, `BuildStale`, `HostRejected`), a stub's `NotImplemented`, and `doctor --strict` when a `required` check fails.
- **64**: a usage error. Examples are a negative `--lines`, an unknown flag, an unknown `--target`, `--layout` or `--pm` value, `--config` with `--all`, a `[path]` that does not exist, and a plugin name that is not kebab-case.[^commands-test]

## Output and audiences

The audience decides the output form. It comes from `--human`, `--agent` or `--ci`, from `PLUGINFINITY_AUDIENCE`, or from detection of an agent or CI environment.[^run] `PLUGINFINITY_LOG_LEVEL` sets the log level.

- **For people**, a finding is a `✗` line and a hint on stderr, `build` and `validate` print one `✓` line per target followed by one indented line per component with notes, `· <path>: <kind> <names>; <kind> <names>` (kinds in the order `dropped`, `degraded`, `tool-dropped`, `hook-matcher-runtime`, `hook-output-ignored`, `hook-omitted`, `monitor-omitted`, names joined by `,`, the `config` line last), and `doctor` prints a checklist grouped into Runtime, Hosts, Tools and Config.[^render-build][^render-doctor]
- **For agents and CI**, a finding, a doctor report, or a build or validate result is one JSON object on stdout. It carries `engine_version`, `distribution` and `ok`, plus `error` (`tag`, `path`, `message`, `remediation`), `checks` (`id`, `status`, `severity`, `version`, `path`, `remediation`), `builds` (`config`, `target`, `out`, `added`, `changed`, `removed`, `notes`) or `validations` (`config`, `target`, `out`, `host`, `notes`), where each note is `{path, kind, name}`. Notes are info only and never change the exit code.
- `logs` for agents and CI prints one JSON object with `engine_version`, `distribution`, `ok`, `directory`, `found`, `files` (`plugin`, `file`, `path`, `present`) and `entries`, each `{ts, host, component, script, message, plugin, file}`, or `{raw, plugin, file}` for a line that does not follow the standard. With `--follow` it prints no wrapper: one entry object per line, the tail first. For people it prints `Logs in <directory>`, then a `==> <plugin>/<file> <==` section of raw lines per file (the header repeats in `--follow` when the file changes); with no log directory it prints `No logs yet: <directory> does not exist.` and how logs get written.[^render-logs]
- stdout carries only that structured output. A usage error's help goes to stderr with the error, and `--help` alone goes to stdout. A `NotImplemented` failure is reported on stderr for every audience.

`--version` prints `pluginfinity v<version>` and, when the bin was launched through the carrier, `via pluginfinity <version>`.

Under Claude Code the environment selects the agent audience on its own; see [the audience gotcha](../gotchas/agent-environment-selects-json-output.md).

[^program]: `../../packages/cli/src/cli/program.ts`
[^run]: `../../packages/cli/src/cli/run.ts`
[^shared]: `../../packages/cli/src/commands/shared.ts`
[^render-config-error]: `../../packages/cli/src/render/config-error.ts`
[^render-build]: `../../packages/cli/src/render/build.ts`
[^render-doctor]: `../../packages/cli/src/render/doctor.ts`
[^logs]: `../../packages/cli/src/commands/logs.ts`
[^render-logs]: `../../packages/cli/src/render/logs.ts`
[^commands-test]: `../../packages/cli/__test__/commands.test.ts`
