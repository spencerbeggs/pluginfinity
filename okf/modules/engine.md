---
type: Module
title: "@pluginfinity/engine"
description: The pluginfinity logic shared by every front end; today config discovery, loading and strict decoding, the typed config and build errors, the doctor program, build and validate for manifests, hooks, skills and agents, the reconciling emit, and ENGINE_VERSION.
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
  - id: hooks
    resource: ../../packages/engine/src/hooks.ts
    title: targetHooks, hookCommand and renderHooks
  - id: skills
    resource: ../../packages/engine/src/skills.ts
    title: readSkills, renderSkill and the skill description limit
  - id: agents
    resource: ../../packages/engine/src/agents.ts
    title: readAgents and renderAgent
  - id: component
    resource: ../../packages/engine/src/component.ts
    title: The shared component reader and frontmatter writer
  - id: frontmatter
    resource: ../../packages/engine/src/frontmatter.ts
    title: mapFrontmatter, the translation tables and appendSections
generated:
  by: okfit/claude-code
  at: 2026-10-03T01:53:17Z
  body_sha256: d361fa9229852d640e8fe0898408f6128bc68b29f1c7b566ad2008c4a855b01b
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
- **Hooks.** `targetHooks` applies a target's per-event overrides to the base `hooks` and maps each event to the target's name. An event the target lacks drops its `fallback: "omit"` entries and otherwise fails the build with `HookEventUnsupported`. `hookCommand` renders an entry as a shell command at the target's plugin root, through `bash` unless `scripts.invoke` is `"exec"`, and `renderHooks` writes the hooks file through one renderer per hooks format.[^hooks] Each target ships the source `hooks/` directory whole, so a script can source its helpers, except scripts that only another target's hooks run. Copied files keep their source mode. A missing script, or one without the executable bit under `exec`, is `HookScriptInvalid`. A source file on a path the build generates, such as `hooks/hooks.json` on Claude Code, is `PathConflict`.[^operations]
- **Skills.** `readSkills` reads every `skills/<name>/SKILL.md`, parses its frontmatter with `@effected/yaml` and decodes it strictly against core's `SkillFrontmatter`. A YAML error is reported at its file line and column, and a name that differs from the directory or a `targets` key that is not a known target fails too, all as `ComponentInvalid`, collected into `ComponentsInvalid`. `mapFrontmatter` applies a target's field map and the component's `targets` block, `applyHostBlocks` keeps or strips each host block, and `renderSkill` writes `SKILL.md` with `name` always set and its `.md` support files processed and the rest copied, every file keeping its source mode. A built `description` over 1,024 characters, the Agent Skills limit Copilot enforces, fails for that target.[^skills]
- **Agents.** `readAgents` reads every `agents/<name>.md` the same way, and its `name` must equal the file stem. `renderAgent` writes `<agents.dir>/<name><agents.suffix>` through the target's agent field map; a field degraded to a body section, such as `skills` on Copilot, is appended as a level-two heading and a list marked like the body's first list.[^agents]
- **Components share one reader.** A frontmatter value plain YAML would cut short at `#` is refused, since Claude Code's reader keeps the text and every YAML parser drops it. Decoded fields keep the author's key order, and when a target's fields come out exactly as they went in, the author's frontmatter text is written unchanged, comments and folding included. Every component problem in a plugin is collected into one `ComponentsInvalid`, so a single build reports them all, and a host-block problem, wrong for every target, is reported once.[^component]
- **Translation tables.** A `translate` entry maps a value through the target's `tools.names` (de-duplicated, with `drop` leaving a tool out and a Claude `mcp__<server>__<tool>` name rewritten to the target's MCP spelling) or its `models` table (where `drop` leaves the field out, as Copilot does for `inherit`).[^frontmatter]
- **`build` and `validate`.** `build` renders every selected target into `<plugin root>/builds/<id>/`; with `check` it writes nothing and fails with `BuildStale` on any difference. `validate` requires current builds, then runs each host's check unless `skipHosts`: `claude plugin validate`, and for Copilot, which has no validate command, a `--plugin-dir` plugin listing that must load the build under its manifest name and version.[^operations] MCP servers are not built yet.
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
[^hooks]: `../../packages/engine/src/hooks.ts`
[^skills]: `../../packages/engine/src/skills.ts`
[^agents]: `../../packages/engine/src/agents.ts`
[^component]: `../../packages/engine/src/component.ts`
[^frontmatter]: `../../packages/engine/src/frontmatter.ts`
[^operations]: `../../packages/engine/src/operations.ts`
