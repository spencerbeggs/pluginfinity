---
type: Module
title: "@pluginfinity/engine"
description: The pluginfinity logic shared by every front end; today config discovery, loading and strict decoding, the typed config and build errors, the doctor program, build and validate for manifests, the reconciling emit, and ENGINE_VERSION.
kind: package
layer: engine
resource: ../../packages/engine
status: draft
tags:
  - architecture
sources:
  - id: package-manifest
    resource: ../../packages/engine/package.json
    title: "@pluginfinity/engine package manifest"
  - id: discovery
    resource: ../../packages/engine/src/discovery.ts
    title: ConfigDiscovery, the upward walk and the --all descent
  - id: loader
    resource: ../../packages/engine/src/loader.ts
    title: ConfigLoader, the jiti import and the strict decode
  - id: errors
    resource: ../../packages/engine/src/errors.ts
    title: The typed config and build errors, and NotImplemented
  - id: selection
    resource: ../../packages/engine/src/selection.ts
    title: ConfigSelection and preparePlugins
  - id: doctor
    resource: ../../packages/engine/src/doctor.ts
    title: runDoctor and the DoctorReport schema
  - id: operations
    resource: ../../packages/engine/src/operations.ts
    title: The build and validate programs and the host checks
  - id: manifest
    resource: ../../packages/engine/src/manifest.ts
    title: renderManifest and the manifest formats
  - id: emit
    resource: ../../packages/engine/src/emit.ts
    title: planEmit, applyEmit and EmitPlan
generated:
  by: okfit/claude-code
  at: 2026-10-03T00:09:53Z
  body_sha256: d88bc43817f7e80ef89f4eb003afc0dcde7bd92786ff3262e56958494b32a9ad
---

# @pluginfinity/engine

## What it is

`packages/engine/` computes everything a front end would otherwise have to implement itself ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).[^package-manifest] The [CLI](cli.md) renders its results, and so will a future MCP front end. Each operation is one program that returns a typed result or fails with a typed error, and `ENGINE_VERSION` is the version to compare when asking whether two reports came from the same build.

## What it does today

- **Discovery.** `ConfigDiscovery.nearest` walks up from a start directory and returns the first `pluginfinity.config.{ts,mts,js,mjs}` it finds. It stops after the first directory that contains `.git`. `ConfigDiscovery.all` returns every config below a directory and never descends into `node_modules`, `builds` or `.git`. Two config files in one directory fail as `ConfigAmbiguous`.[^discovery]
- **Loading.** `ConfigLoader.load` imports the file through jiti with its module and filesystem caches off, takes the default export, and decodes it strictly against `PluginfinityConfig` from [targets](targets.md). An unknown top-level key fails as `UnknownTarget`, and a config that decodes but enables no target fails as `ConfigInvalid`.[^loader] The shape is the [config interface](../interfaces/config.md).
- **Selection.** `ConfigSelection` is one of nearest, all, or an explicit file. `preparePlugins` selects, loads, and checks that each `--target` asked for is enabled (`TargetNotEnabled` otherwise). It is the front half `build` and `validate` share.[^selection]
- **Errors.** `ConfigNotFound`, `ConfigAmbiguous`, `ConfigLoadFailed`, `ConfigInvalid`, `UnknownTarget` and `TargetNotEnabled` together form `ConfigError`. Each one carries a path, a message and a one-line remediation hint, so a front end can render it for any audience. `PackageVersionMissing`, `BuildStale` (with one `TargetDrift` per drifted target) and `HostRejected` form `BuildError`, with the same three parts. `NotImplemented` marks an operation that exists in the command surface but is not built yet.[^errors]
- **Manifests.** `renderManifest` builds a target's manifest from the config, the target's name override and the `package.json` version, through one function per manifest format, cut to the target's key allowlist in its order.[^manifest]
- **Emit.** `planEmit` compares the files a build produces with what a build directory holds, by bytes and mode, and returns an `EmitPlan` of added, changed, removed and unchanged paths. `applyEmit` stages added and changed files in a sibling temporary directory, then renames each into place, deletes removed files and stray empty directories, and prunes the directories that leaves empty. Unchanged files are never written, so their mtimes stay, and generated files are `0644`.[^emit]
- **`build` and `validate`.** `build` renders every selected target into `<plugin root>/builds/<id>/`; with `check` it writes nothing and fails with `BuildStale` on any difference. `validate` requires current builds, then runs each host's check unless `skipHosts`: `claude plugin validate`, and for Copilot, which has no validate command, a `--plugin-dir` plugin listing that must load the build under its manifest name and version.[^operations] Skills, agents, hooks and MCP servers are not built yet.
- **`doctor`.** `runDoctor` never fails; every problem is a check in the `DoctorReport`. It checks Node.js against the `24.11.0` floor, the package manager it detects from the nearest lockfile (npm when there is none), each host CLI (`claude`, `copilot`), `bats`, `git`, and the config. A host CLI is `required` only when a loaded config targets that host, and `info` otherwise. A missing package manager, `bats` or `git` is a `warning`. A missing config is `info`, because doctor runs anywhere, but a config that fails to load is `required`. Each probe and each config load times out after 10 seconds. `DoctorReport.ok` is false only when a `required` check fails.[^doctor]

## Rules

- No file under `src/` reads `process`, with no allowlist. A front end reads process values once in its own `main.ts` and passes them down: the start directory and the Node.js version both arrive as input. A boundary test pins this.
- When two front ends need the same thing, it moves down into the engine, never sideways between front ends.
- As a library it declares `effect` and `@effect/platform-node` as peer dependencies.

## Status

The six-stage pipeline, its errors and `check` mode are designed in [the roadmap](../roadmaps/pluginfinity-first-release.md)'s design direction and land in its builder phase, with each format encoder the [target description](../models/target-description.md) names.

[^package-manifest]: `../../packages/engine/package.json`
[^discovery]: `../../packages/engine/src/discovery.ts`
[^loader]: `../../packages/engine/src/loader.ts`
[^errors]: `../../packages/engine/src/errors.ts`
[^selection]: `../../packages/engine/src/selection.ts`
[^doctor]: `../../packages/engine/src/doctor.ts`
[^manifest]: `../../packages/engine/src/manifest.ts`
[^emit]: `../../packages/engine/src/emit.ts`
[^operations]: `../../packages/engine/src/operations.ts`
