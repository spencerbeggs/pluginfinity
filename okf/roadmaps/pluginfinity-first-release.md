---
type: Roadmap
title: pluginfinity first release
description: From an empty workspace to a published pluginfinity that builds its companion plugin's Claude Code and Copilot outputs from one source.
tags:
  - architecture
  - portability
  - release
  - dx
status: draft
stale_after: 2026-12-31T00:00:00Z
gate: pluginfinity is published to npm, it builds the companion plugin's claude and copilot outputs from one source under plugins/pluginfinity/, and the companion covers the plugin-authoring guidance it takes over from plugin-bot.
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: Layout, versioning and scope set by the repository owner across the 2026-09-30 and 2026-10-02 planning sessions
  - id: bot-roadmap
    resource: https://github.com/spencerbeggs/bot/blob/270cbf6c4cbdabf34ada7412b5c40e3e017c685a/okf/roadmaps/single-source-plugin-builds.md
    title: The bot repository's single-source plugin builds roadmap this one carries forward
  - id: impeccable
    resource: https://github.com/pbakaus/impeccable/tree/c74755d920985f7a92cef691ca970ba95f90126e
    title: impeccable, the prior art surveyed
  - id: impeccable-providers
    resource: https://github.com/pbakaus/impeccable/blob/c74755d920985f7a92cef691ca970ba95f90126e/scripts/lib/transformers/providers.js
    title: impeccable's per-host configuration table
  - id: impeccable-plugin-paths
    resource: https://github.com/pbakaus/impeccable/blob/c74755d920985f7a92cef691ca970ba95f90126e/scripts/lib/plugin-paths.js
    title: impeccable's post-build rewrite of the Claude Code plugin copy
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:36:46Z
  body_sha256: ae9154337a6e4b028512c253a700b684e5aeb00ae98f29a6a20b80d73d913b98
---

# pluginfinity first release

This is planned intent, not a decision. It carries forward the single-source builds plan made in the bot repository on 2026-09-30,[^bot-roadmap] revised on 2026-10-02 into a standalone CLI with a companion plugin that succeeds plugin-bot ([decision](../decisions/pluginfinity-is-a-cli-application.md)). When the gate holds, deprecate this concept and record what the work produced as Decisions.

## Why

A plugin that ships to several hosts keeps a full copy per host, kept in step by hand-porting. The [divergence measurement](../measurements/plugin-bot-target-divergence.md) found that most differences between plugin-bot's two copies are mechanical or a recurring fallback pattern, which a build can produce. The few host-specific passages that remain would be marked inside one file instead of living in two.

## Target layout

The repository owner set this shape:[^owner-direction]

```text
packages/
  core/ targets/ engine/ cli/  the @pluginfinity/* layer packages
  pluginfinity/                 the carrier users install
plugins/<name>/
  pluginfinity.config.ts        targets and per-target rules for this plugin
  package.json                  the only package for the plugin
  skills/  agents/  hooks/ ...  host-neutral source
  builds/
    claude/                     generated, committed
    copilot/                    generated, committed
```

- **One package and one build per plugin.** `plugins/<name>/` is the workspace, matched by the `plugins/*` glob. The build reads the source and writes every target into `builds/`.
- **Build output is committed.** Marketplaces load a plugin from a subdirectory and need the complete, transformed output there. Each host has its own rules for a plugin reaching into other directories, so one build that writes a self-contained folder per host is the portable choice.
- **The folder name names the host.** `plugins/<name>/builds/<id>/`, where `<id>` is the target id (`claude`, `copilot`) that also names the config key and `--target <id>`, keeps the host name in the path of every shipped file. The source folders are host-neutral.

## Versioning

The repository owner set this:[^owner-direction]

- Changesets track `plugins/<name>/package.json`, a private package that is never published to npm, and every target of a plugin shares that version, even when a change touched only one host.
- The build copies the version from `plugins/<name>/package.json` into each target manifest under `builds/`.
- In CI, the plugin package's `versionFiles` entries in `.changeset/config.json` bump the manifests under `builds/` directly.
- pluginfinity does nothing about versioning beyond that copy. pluginfinity itself is versioned and published to npm like any package.

## Prior art: impeccable

impeccable builds one design skill into about 18 hosts from a single source tree.[^impeccable] What carries over:

- **Hosts as data.** One config table gives each host its directory, the frontmatter fields it keeps, its agent file format and its hook file location. A single transformer factory runs every host.[^impeccable-providers]
- **Two ways to vary content per host.** `{{placeholder}}` tokens are filled from a per-host table, and `<host>...</host>` blocks are kept for one host and stripped for the rest.
- **Fallbacks for a missing feature.** For hosts without subagents, each agent is also emitted as a reference file whose preamble tells the model to play the role inline.
- **Build checks.** These cover agreement of versions across manifests, frontmatter shape, and an allowlist of manifest keys known to load. The allowlist exists because a manifest key once shipped that silently loaded zero agents and `claude plugin validate` did not flag it. An end-to-end test installs the output into a sandboxed Claude Code.

What to avoid: impeccable's main output is a project install, and the Claude Code plugin is derived afterwards by copying it and rewriting it with regexes, guarded by checks that the rewrite worked.[^impeccable-plugin-paths] The config describes formatting rather than what each host can do, so special cases (one host checked by name, a hard-coded set of hosts) leak into the factory.

## Design direction

- **Targets described by capability.** Designed as the [target description](../models/target-description.md): data plus a closed set of named formats ([decision](../decisions/targets-are-data-plus-named-formats.md)), with field maps that are total over core's frontmatter fields and `unresolved` cells where the docs leave a fact open.
- **Source model.** Designed as the [plugin source model](../models/plugin-source-model.md): skills, agents, hooks and MCP servers, written in [Claude Code's vocabulary](../decisions/claude-code-names-are-the-source-vocabulary.md), with host blocks, `pluginfinity://` references and a per-component `targets` block.
- **Declared fallbacks.** A component declares per target whether a missing capability means omit, degrade to a named form (description suffix, body section, inline role) or fail.
- **Typed references instead of free-text placeholders.** A reference to another skill's file resolves per target and must exist, so an unresolved reference is a build error, never shipped text.
- **Hooks declared once, generated per target.** Hooks are declared in a host-neutral form in `pluginfinity.config.ts`, with per-target overrides, and the build generates each target's hooks file from that declaration rather than transforming one host's `hooks.json` into another's.[^owner-direction] Host event names, tool names, handler fields and file locations come from the target descriptions ([Claude Code](../references/claude-code-plugin-format.md), [Copilot](../references/copilot-cli-plugin-format.md)). Hook commands are bash scripts ([decision](../decisions/plugins-carry-no-node-dependencies.md)). Copilot runs a plugin hook from the plugin root and substitutes `${PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_ROOT}` in its command, whether the plugin is loaded in place or installed, which the docs leave unstated ([measurement](../measurements/copilot-plugin-hook-environment.md)). Typed Effect hooks compiled to binaries are a later goal, with [claude-binary-plugin](../references/claude-binary-plugin.md) as prior art.
- **Host formats.** The copilot target emits Agent Plugins 1.0 ([decision](../decisions/copilot-target-emits-agent-plugins.md)). The host facts behind the target descriptions are mirrored under [references](../references/index.md), and where the SchemaStore schemas and the host docs disagree, the docs win.
- **Pipeline.** Six stages in `@pluginfinity/engine`, built on the `@effected` markdown, yaml, jsonc, glob, walker and memfs packages:
  1. **Read** the config, `skills/`, `agents/` and referenced scripts.
  2. **Decode** frontmatter, config and hooks against core's schemas.
  3. **Resolve** host blocks, `pluginfinity://` references, scripts and each component's `targets` block.
  4. **Transform** per target: field maps, body rendering, and the format encoders for manifest, hooks and MCP.
  5. **Check** per target: allowlisted manifest keys, no lockfile or `node_modules`, host name rules, and executable bits under `scripts.invoke: "exec"`.
  6. **Emit** each target as an in-memory tree. `build` swaps it into `builds/<id>/` through a sibling temp directory, so stale files disappear; `build --check` compares it with disk byte for byte; `validate` stops after the check stage.

  Output is deterministic (stable key order, LF, trailing newline, sorted files), so `--check` is a byte comparison. Errors are collected across the whole plugin and each carries the file and, where meaningful, the field or line: `SourceInvalid`, `NameMismatch`, `HostBlockInvalid`, `ReferenceUnresolved`, `ScriptMissing`, `ScriptNotExecutable`, `CapabilityMissing`, `FactUnresolved`, `OutputInvalid` and `BuildStale`.
- **Testing.** Core unit tests cover every schema, including rejection of unknown fields. Targets unit tests pin field-map totality and event-table coverage, and a carrier layering test pins an engine implementation for every format literal and degrade form. Engine unit tests cover each transform and encoder and one fixture plugin per error; integration tests run the whole pipeline over memfs against golden `builds/` trees, with `--check` clean and stale. `plugins/dogfood/` grows to use every feature once, commits its `builds/`, and runs `build --check` in CI, with `claude plugin validate --strict` against `builds/claude/` when the `claude` CLI is present. A Copilot `--plugin-dir` load stays manual because it spends a request.
- **Command surface.** `init`, `plugin add`, `build` (with `--check` as the check mode), `validate` and `doctor` are in place as flags and exit codes ([CLI interface](../interfaces/cli.md)); exit codes and stdout/stderr discipline follow `@effected/cli`.

## Phases

0. **Workspace.** Done on 2026-10-02: the template became a workspace with the CLI split into carrier-pattern layer packages under `packages/` ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)) and two plugin workspaces, `plugins/pluginfinity/` (the companion) and `plugins/dogfood/` (the end-to-end fixture), each depending on the `pluginfinity` carrier through `workspace:*`; and this bundle was seeded.
1. **Design.** Done on 2026-10-02. The command surface and the first `pluginfinity.config.ts` shape landed first ([CLI interface](../interfaces/cli.md), [config interface](../interfaces/config.md)); the [plugin source model](../models/plugin-source-model.md), the [target description](../models/target-description.md), the pipeline and the test plan above complete it.
2. **Builder.** Config discovery, loading and `doctor` work, and `build` and `validate` stop with `NotImplemented` after loading the config. What remains is the pipeline and `check` mode in `@pluginfinity/engine`, the Claude Code and Copilot capability descriptions in `@pluginfinity/targets`, the `init` and `plugin add` scaffolding, and the host-CLI half of `validate`. Grow `plugins/dogfood/` alongside, so every CLI feature is exercised end to end even when the companion does not use it.
3. **Companion plugin.** Author `plugins/pluginfinity/` as a single source from the start, drawing on plugin-bot's content in the bot repository as a reference rather than copying its two target folders. Compare its generated `builds/` with plugin-bot's hand-maintained targets to check that the build reproduces what porting produced by hand.
4. **Guards and docs.** Wire `check` into CI. Teach the companion plugin the pluginfinity authoring pattern, including a hook that blocks direct edits under `plugins/*/builds/**`.
5. **First publish.** The name is settled as pluginfinity ([decision](../decisions/pluginfinity-name.md)). Write the README, make the carrier publishable (its manifest is still `private: true`), and publish to npm.

## Open questions

- **The local dev loop.** `pnpm claude --plugin-dir plugins/pluginfinity/builds/claude` needs a rebuild (or a watch mode) before a source edit shows.
- **Where tests live.** Source and schema tests would sit at the plugin root. Host-specific checks (`claude plugin validate --strict`, install tests) would run against `builds/<target>/`.
- **Distributing the companion.** How the companion plugin reaches users (which marketplace, and how its entries are pinned on release) is undecided. Whether plugin-bot is removed from the owner's marketplaces after pluginfinity ships is also undecided.
- **Marketplace pinning.** The bot repository repins through `spencerbeggs/ai-plugin-marketplace-manager`. Whether pluginfinity should eventually absorb that step, or stay a pure builder as the [project](../project.md) currently says, is undecided.

[^owner-direction]: conversation with the repository owner, 2026-09-30 and 2026-10-02
[^bot-roadmap]: <https://github.com/spencerbeggs/bot/blob/270cbf6c4cbdabf34ada7412b5c40e3e017c685a/okf/roadmaps/single-source-plugin-builds.md>
[^impeccable]: <https://github.com/pbakaus/impeccable/tree/c74755d920985f7a92cef691ca970ba95f90126e>
[^impeccable-providers]: <https://github.com/pbakaus/impeccable/blob/c74755d920985f7a92cef691ca970ba95f90126e/scripts/lib/transformers/providers.js>
[^impeccable-plugin-paths]: <https://github.com/pbakaus/impeccable/blob/c74755d920985f7a92cef691ca970ba95f90126e/scripts/lib/plugin-paths.js>
