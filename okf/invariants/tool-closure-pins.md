---
type: Invariant
title: The tool packages pin Effect and the kit exactly, so pluginfinity's closure is sealed
description: "pluginfinity, @pluginfinity/cli and @pluginfinity/engine write catalog:effected:exact on every effect, @effect/* and @effected/* dependency, and the carrier and CLI declare every required peer of their installed closure; a test fails on either."
resource: ../../packages/pluginfinity/__test__/closure.test.ts
status: draft
tags:
  - deps
  - release
  - architecture
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-11-11T00:00:00Z
    title: The owner's direction to seal the CLI's closure so it installs beside other Effect and kit versions
  - id: carrier-closure
    resource: https://github.com/spencerbeggs/effected/tree/main/plugins/claude-code/skills/design-patterns/references
    title: The effected design-patterns skill's carrier closure reference
  - id: closure-test
    resource: ../../packages/pluginfinity/__test__/closure.test.ts
    title: The closure test
  - id: closure-utils
    resource: ../../packages/pluginfinity/__test__/utils/closure.ts
    title: The manifest and peer-closure helpers the test runs
generated:
  by: okfit/claude-code
  at: 2026-11-12T03:02:39Z
integrity:
  generated:
    body: 6c95c91602c1bb4b
---

# The tool packages pin Effect and the kit exactly, so pluginfinity's closure is sealed

## Property

pluginfinity is a tool: it runs beside a host project's own Effect and `@effected/*` packages and shares no service, schema or brand with them. It owns the versions it was tested with.[^owner-direction] Two things hold:

- **Exact pins.** The packages that run as part of the tool are the [carrier](../modules/pluginfinity.md), the [CLI](../modules/cli.md) and the [engine](../modules/engine.md). Each writes `catalog:effected:exact` on every `effect`, `@effect/*` and `@effected/*` entry in its `dependencies`, and each publishes those entries as plain versions.[^carrier-closure] A kit patch therefore never reaches an installed pluginfinity without a pluginfinity release, and no kit library inside the tool can take a peer from another release line.
- **A declared peer closure.** The carrier and the CLI install the tool, so each declares every required peer of its installed graph as a regular dependency: the Effect family and the workspace packages, walked through regular dependencies. A peer resolves from the package that installs it, so an undeclared one would come from whatever copy the host's tree holds.

The engine is pinned even though it is only ever installed beneath the carrier. A regular dependency follows its own range whatever the carrier pins, and the engine carries `@effected/kit`, whose `CurrentDistribution` reference the CLI, the engine and the carrier must share as one copy. Core and targets take only an `effect` peer, so they keep `catalog:effected:peers`, like the engine's own `effect` and `@effect/platform-node` peers; the carrier's exact copy fills each one.

## Mechanism

`closure.test.ts` in the carrier reads each tool package's source manifest and fails on any Effect-family dependency not written `catalog:effected:exact`. It also walks the installed graph below the carrier and the CLI and fails on any required peer they leave undeclared.[^closure-test] Each check has a positive control: the manifest check must flag a `catalog:effected` entry, and the walk must report `effect` missing when it starts from the engine, which leaves `effect` to its installer. The walk skips optional peers. `@effected/config-file` and `@effected/xdg` take the `jsonc`, `toml` and `yaml` codecs as optional peers, and only the codec subpaths load them, which pluginfinity does not import.[^closure-utils]

## What would break it

- Writing `catalog:effected` or a caret on a tool package's kit dependency. That publishes a range, and the manifest check fails.
- Adding a front end, such as an MCP server, without adding its directory to `TOOL_PACKAGE_DIRS` and, if it installs the tool, to `INSTALLED_PACKAGE_DIRS`. The check then never sees the new package.
- Importing a codec subpath of `@effected/config-file`. Its optional peer then loads at run time, and the carrier has to declare it exactly.

## What it does not seal

- `jiti` and other non-kit dependencies keep caret ranges. They share no state with a host, and the owner accepts them floating.[^owner-direction]
- A kit library's own regular dependencies under the tool follow their own carets. Only bundling the closure into `dist` would close that.[^carrier-closure]
- A host that pins `effect` graph-wide, as the effected catalog plugin does, holds the tool's `effect` to the host's version.

[^owner-direction]: conversation with the repository owner, 2026-11-11
[^carrier-closure]: <https://github.com/spencerbeggs/effected/tree/main/plugins/claude-code/skills/design-patterns/references>
[^closure-test]: `packages/pluginfinity/__test__/closure.test.ts`
[^closure-utils]: `packages/pluginfinity/__test__/utils/closure.ts`
