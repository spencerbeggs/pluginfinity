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
  - id: render-doctor
    resource: ../../packages/cli/src/render/doctor.ts
    title: The doctor checklist and its JSON form
  - id: commands-test
    resource: ../../packages/cli/__test__/commands.test.ts
    title: The usage-error and NotImplemented exit-code cases
generated:
  by: okfit/claude-code
  at: 2026-10-03T00:09:53Z
  body_sha256: 1a6442b76d62d7ec5468366a276a5ed31518698900d4be8a2a338b52bb24ef33
---

# The pluginfinity command line

The promise the `pluginfinity` bin makes to the people, agents and CI jobs that run it. The [CLI module](../modules/cli.md) implements it over the [engine](../modules/engine.md). Several commands are still stubs, and their flags are in place so scripts and docs can be written against them now.

## Commands

| Command | What it does today |
| :-- | :-- |
| `pluginfinity init [dir]` | Stub. Takes `--layout root\|plugin\|plugins`, `--name`, `--pm pnpm\|npm\|yarn\|bun`, `--target`, `--no-changesets`, `--no-ci` and `--yes`, checks them, then fails with `NotImplemented`. |
| `pluginfinity plugin add <name>` | Stub. Takes `--target` and `--dir`, checks the name, then fails with `NotImplemented`. A bare `pluginfinity plugin` prints the group's help. |
| `pluginfinity build [path]` | Renders each enabled target into `builds/<id>/` beside the config, writing only files that differ, and prints what it added, changed and removed. Takes `--target`, `--all`, `--config` and `--check` (rebuild in memory, compare with `builds/`, and fail with `BuildStale` on any difference, writing nothing). |
| `pluginfinity validate [path]` | Requires current builds (`BuildStale` otherwise), then runs each host's check: `claude plugin validate` on `builds/claude/`, and a `copilot --plugin-dir` plugin listing that must load `builds/copilot/` under its manifest name and version (`HostRejected` otherwise). Takes `--target`, `--all`, `--config` and `--no-host` (skip the host CLIs). |
| `pluginfinity doctor [path]` | Works. Reports on the runtime, the host CLIs, the tools and the config. Takes `--all`, `--config` and `--strict`. |

The commands that read a config share their inputs:[^shared]

- `[path]` is where config discovery starts, the launch directory by default. A relative path resolves against the launch directory, and a `[path]` that does not exist is a usage error, so a typo never falls through to a config further up the tree.
- `--target <id>` is repeatable and limited to the known ids (`claude`, `copilot`). With none given, every enabled target is used. Naming a target the config does not enable is a finding (`TargetNotEnabled`).
- `--all` selects every config below `[path]`, and `--config <file>` names one file with no discovery. Giving both is a usage error.

The root command shares `--human`, `--agent` and `--ci` with every subcommand and provides `--help`, `--version` and `--log-level`.[^program] A bare `pluginfinity` prints help.

## Exit codes

- **0**: success. `doctor` exits 0 even when a check fails, unless `--strict` is given.
- **1**: a finding. Every config failure (`ConfigNotFound`, `ConfigAmbiguous`, `ConfigLoadFailed`, `ConfigInvalid`, `UnknownTarget`, `TargetNotEnabled`) is reported as a finding and exits 1.[^render-config-error] So is every build failure (`PackageVersionMissing`, `BuildStale`, `HostRejected`), a stub's `NotImplemented`, and `doctor --strict` when a `required` check fails.
- **64**: a usage error. Examples are an unknown flag, an unknown `--target`, `--layout` or `--pm` value, `--config` with `--all`, a `[path]` that does not exist, and a plugin name that is not kebab-case.[^commands-test]

## Output and audiences

The audience decides the output form. It comes from `--human`, `--agent` or `--ci`, from `PLUGINFINITY_AUDIENCE`, or from detection of an agent or CI environment.[^run] `PLUGINFINITY_LOG_LEVEL` sets the log level.

- **For people**, a finding is a `✗` line and a hint on stderr, `build` and `validate` print one `✓` line per target, and `doctor` prints a checklist grouped into Runtime, Hosts, Tools and Config.[^render-doctor]
- **For agents and CI**, a finding, a doctor report, or a build or validate result is one JSON object on stdout. It carries `engine_version`, `distribution` and `ok`, plus `error` (`tag`, `path`, `message`, `remediation`), `checks` (`id`, `status`, `severity`, `version`, `path`, `remediation`), `builds` (`config`, `target`, `out`, `added`, `changed`, `removed`) or `validations` (`config`, `target`, `out`, `host`).
- stdout carries only that structured output. A usage error's help goes to stderr with the error, and `--help` alone goes to stdout. A `NotImplemented` failure is reported on stderr for every audience.

`--version` prints `pluginfinity v<version>` and, when the bin was launched through the carrier, `via pluginfinity <version>`.

Under Claude Code the environment selects the agent audience on its own; see [the audience gotcha](../gotchas/agent-environment-selects-json-output.md).

[^program]: `../../packages/cli/src/cli/program.ts`
[^run]: `../../packages/cli/src/cli/run.ts`
[^shared]: `../../packages/cli/src/commands/shared.ts`
[^render-config-error]: `../../packages/cli/src/render/config-error.ts`
[^render-doctor]: `../../packages/cli/src/render/doctor.ts`
[^commands-test]: `../../packages/cli/__test__/commands.test.ts`
