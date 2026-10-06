---
type: Module
title: "@pluginfinity/cli"
description: The pluginfinity command-line front end on @effected/cli; it holds the command tree, renders what the engine computes for people or agents, declares no bin, and runs through the carrier's shim.
kind: package
layer: front end
resource: ../../packages/cli
status: draft
tags:
  - architecture
  - dx
sources:
  - id: package-manifest
    resource: ../../packages/cli/package.json
    title: "@pluginfinity/cli package manifest"
  - id: reference-cli
    resource: https://github.com/spencerbeggs/effected/tree/main/packages/schemastore-cli
    title: The schemastore CLI, the layout this package follows
  - id: main
    resource: ../../packages/cli/src/main.ts
    title: The process boundary and its exit-after-flush teardown
  - id: run
    resource: ../../packages/cli/src/cli/run.ts
    title: The program under CliRuntime.main, with the environment variables and the version formatter
  - id: program
    resource: ../../packages/cli/src/cli/program.ts
    title: The root command and its subcommands
  - id: commands
    resource: ../../packages/cli/src/commands
    title: One file per command, plus the shared flags and the plugin-name check
  - id: render
    resource: ../../packages/cli/src/render
    title: The audience-aware renderers for config errors, the doctor report and build and validate results
generated:
  by: okfit/claude-code
  at: 2026-10-06T00:41:19Z
  body_sha256: 33e6a96913885500e5f33d3be000d00488c9ad6ff979fbdcc28f933d260d8082
---

# @pluginfinity/cli

## What it is

`packages/cli/` is the command-line front end of pluginfinity.[^package-manifest] It sits between the [engine](engine.md) and the [`pluginfinity` carrier](pluginfinity.md) ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)). It parses arguments, calls the engine, and renders the result. It owns no config or build logic of its own, and it declares no `bin`: users run it through the carrier's `pluginfinity` shim. The commands, flags and exit codes it promises are the [CLI interface](../interfaces/cli.md).

## Shape

The layout follows the `schemastore` CLI in the effected repository, with the carrier pattern's four-file entry contract:[^reference-cli]

- `src/bin.ts` calls `main()` and nothing else. It is a workspace-local development entry, not a published bin.
- `src/main.ts`, exported as `./main`, is the process boundary and the only file that reads `process`.[^main] It reads the arguments, the working directory and the Node.js version once, and passes them down. `main` takes an optional `distribution`, which the carrier's shim passes so `--version` reports `via pluginfinity <version>`.
- `src/index.ts`, exported as `.`, is a side-effect-free barrel that never exports `main`.
- `src/version.ts` holds the build-time `__PACKAGE_VERSION__` define.

Behind the entry:

- `src/cli/run.ts` runs the program under `CliRuntime.main` from `@effected/cli`, which reports failures through the logger, maps usage errors to exit 64, and resolves the audience and colour.[^run] The audience and log level can also be set through `PLUGINFINITY_AUDIENCE` and `PLUGINFINITY_LOG_LEVEL`. A usage error's help goes to stderr, so stdout carries only structured output. `main.ts` calls `run` with the real platform; tests in `__test__/` call the same `run` over a test platform, so they exercise the shipped wiring without spawning a process.
- `src/cli/program.ts` holds the root command, which shares the `--human`, `--agent` and `--ci` audience flags with every subcommand and prints help when run bare.[^program]
- `src/commands/` holds one file per command (`init`, `plugin add`, `build`, `validate`, `doctor`).[^commands] `shared.ts` holds the `[path]`, `--target`, `--all` and `--config` inputs and turns them into the engine's `ConfigSelection`; `name.ts` checks a plugin name against core's `PluginName`.
- `src/render/` draws engine results for the audience: a config error as a message and a hint on stderr for people or one JSON object on stdout for agents and CI, the doctor report as a grouped checklist or one JSON object, and build and validate results as one `✓` line per target, each followed by its [build notes](../decisions/build-notes-report-dropped-fields.md) one line per component, or one JSON object whose builds and validations carry a `notes` array.[^render]

The custom `--version` formatter prints the version line as plain text. `@effected/cli` 0.11.0 offers no way to add a suffix while keeping its coloured default.

### Teardown

`main.ts` passes `NodeRuntime.runMain` a teardown that always calls `process.exit` once stdout has flushed, including on exit 0.[^main] The engine loads a user's config in-process through jiti, so a timer or socket the config leaves open would otherwise keep a successful run alive after its output. Waiting for the flush keeps piped JSON whole. An end-to-end test in the carrier runs the built bin against such a config and requires it to exit promptly.

As an installed package it declares its full runtime closure as regular `dependencies`, including entries that only satisfy a library's peer.

## Status

`doctor` works. `init` and `plugin add` validate their flags and then fail with `NotImplemented`. `build` and `validate` cover every component kind: manifests, skills, agents, hooks, and MCP and LSP servers with their launchers. No other command is a stub; those two come in a later phase of [the roadmap](../roadmaps/pluginfinity-first-release.md).

Under Claude Code a plain `pluginfinity doctor` prints JSON; see [the audience gotcha](../gotchas/agent-environment-selects-json-output.md).

[^package-manifest]: `../../packages/cli/package.json`
[^reference-cli]: <https://github.com/spencerbeggs/effected/tree/main/packages/schemastore-cli>
[^main]: `../../packages/cli/src/main.ts`
[^run]: `../../packages/cli/src/cli/run.ts`
[^program]: `../../packages/cli/src/cli/program.ts`
[^commands]: `../../packages/cli/src/commands`
[^render]: `../../packages/cli/src/render`
