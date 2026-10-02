---
type: Reference
title: claude-binary-plugin prior art
description: "The owner's earlier Bun and Effect v3 SDK that compiles typed Claude Code hook handlers into one single-file executable per plugin, recorded as prior art for building binary hooks inside pluginfinity."
status: draft
tags:
  - architecture
  - portability
stale_after: 2027-01-01T00:00:00Z
sources:
  - id: claude-binary-plugin-repo
    resource: https://github.com/spencerbeggs/claude-binary-plugin/tree/1348b7215e295eaf26d482e233175b557bebf972
    title: claude-binary-plugin repository
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: Owner's note that reviving binary hooks inside pluginfinity is a long-term goal
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:08:02Z
  body_sha256: 71807d35a97b23ae1e26f4e164c2f60acfe77c083956da0b1c0b97eea7afabe8
---

# claude-binary-plugin prior art

## Purpose

claude-binary-plugin is a TypeScript SDK for writing Claude Code plugin hooks (and plugin "commands") as typed Effect handlers and compiling the whole plugin into one single-file Bun executable, with a generated `hooks/hooks.json` that routes every hook event to that binary.[^claude-binary-plugin-repo] It is the owner's earlier project. Reviving the idea inside pluginfinity, possibly with a Bun builder, starting from a similar shaping of Effect-authored hooks, is a long-term goal, not current scope.[^owner-direction] This page mirrors the repository at the commit in its source link and closes with observations on fit.

## Layout

A Bun workspace (`bun@1.3.14`, Turbo, Biome, `tsgo` type checking) with two members:[^claude-binary-plugin-repo]

- `package/`: the SDK, published name `claude-binary-plugin` (`0.1.0`, `@spencerbeggs/claude-binary-plugin` on GitHub Packages). Two entry points, exported straight from source: `src/index.ts` (public API) and `src/testing.ts` (test layers and the `PluginTester`). No `bin`.
- `plugin/`: `test-plugin`, a dogfood plugin with `.claude-plugin/plugin.json`, `plugin.config.ts`, `plugin.state.ts`, `hooks/pre-tool-use.ts`, `hooks/session-start.ts`, `plugin.build.ts` and `__test__/plugin.test.ts`.

Inside `package/src/`:

- `hooks/`: one module per hook event (26 files) plus `shared.ts` and `types.ts` (`HooksMap`, `InferHandlers`, `HookOutcomeMap`, the valid-outcome tag sets).
- `outcomes/`: the handler return values (`Allow`, `Deny`, `Ask`, `Modify`, `Block`, `Continue`, `AddContext`, `NoAction`, `Skip`, `Retry`, `WatchPaths`) and `ContextBuilder` (`MarkdownContext`, `XmlContext`).
- `plugin/`: `config.ts` (`PluginConfig`, the `ClaudePlugin` orchestrator), `handler.ts`, `commands.ts`, `infer.ts`, `state.ts`.
- `build/`: `builder.ts` (`PluginBuilder`, about 2,000 lines), `EntrypointGenerator.ts`, `HookExtractor.ts`, `CommandExtractor.ts`, `ManifestGenerator.ts`, `ProxyTemplate.ts`.
- `services/` (`Context.Tag` interfaces) and `layers/` (`*Live` and `*Test` implementations), `errors/` (one `Data.TaggedError` per file), `schemas/` (branded types, hook literals, JSON), `otel/` (an OpenTelemetry sidecar), `types/`, `testing/`.
- Design notes in `.claude/design/*.md`, user docs in `docs/`.

## Authoring a hook

A plugin is three files: config, handlers, build.[^claude-binary-plugin-repo] The config is a `Schema.Class` subclass whose statics declare env-var options, persisted state and a setup function; statics are used because Bun's tree-shaking stripped class methods from compiled binaries otherwise (`plugin/plugin.config.ts`):

```ts
class TestConfig extends PluginConfig.extend<TestConfig>("TestConfig")({
  prefix: Schema.Literal("TEST_PLUGIN"),
}) {
  static readonly options = Schema.Struct({
    MODE: Schema.optionalWith(Schema.Literal("strict", "lenient"), {
      default: () => "strict" as const,
    }),
  });
  static readonly state = PluginState;
  static readonly setup = async () => new PluginState({ /* detected env */ });
}
export type Handlers = InferHandlers<typeof TestConfig>;
```

A handler receives `{ input, options, state }` (all `ReadonlyDeep`) and returns an outcome instance. The type is `PluginHandler<TInput, TOutput, TOptions, TState, TOutcome>`, a function returning the output or outcome directly, as a `Promise`, or as an `Effect` with no requirements (`src/plugin/handler.ts`). Each hook type narrows the allowed outcomes at compile time (`plugin/hooks/pre-tool-use.ts`):

```ts
const handler: Handlers["PreToolUse"] = ({ input, options }) => {
  if (options.MODE === "strict" && input.tool_name === "Bash") {
    return new Deny({ summary: "blocked", reason: "strict mode" });
  }
  return new Allow({ summary: `allowed ${input.tool_name}` });
};
```

The build file wires handlers to events by name, with an optional `tools` filter that becomes the `matcher`:

```ts
const plugin = new ClaudePlugin(TestConfig, {
  SessionStart: [{ name: "init", handler: sessionStartHandler }],
  PreToolUse: [{ name: "guard", handler: preToolUseHandler }],
});
await plugin.build({ rootDir: import.meta.dir });
```

Each `src/hooks/<Event>.ts` co-locates seven parts: the stdin wire schema (`<Event>Input`, a `Schema.Class` with snake-case fields such as `session_id`, `hook_event_name: Schema.Literal("PreToolUse")`, `tool_name`, `tool_input`, `tool_use_id`, optional `agent_id`, `agent_type`, `permission_mode`); a domain `<Event>Event` with paths normalized to the branded `NormalizedPath` via `fromInput`; the outcome union and `VALID_OUTCOME_TAGS`; an internal output schema, a `Schema.Union` discriminated on `status` (`executed`, `skipped`, `disabled`, `cached`, `error`, `timeout`); a `<Event>Response` wire schema; the handler type; and the hook-definition type.

Each outcome is a `Schema.Class` with `toResponse()` (the stdout JSON) and `toTelemetry()`; extra fields added through `.extend()` become OTEL metrics. Observed wire shapes: `Deny` writes `{ permissionDecision: "deny", reason }`, `Ask` writes `{ permissionDecision: "ask", reason? }`, `Block` writes `{ decision: "block", reason }`, `AddContext` writes `{ additionalContext }`, `WatchPaths` writes `{ watchPaths }`, and only `Retry` nests under `hookSpecificOutput`. PreToolUse decisions therefore sit at the top level with a `reason` key, not under `hookSpecificOutput` with `permissionDecisionReason`; that has not been checked here against a live Claude Code session.

Exit codes: a handled run writes the response JSON to stdout and exits 0 (`RunResult.code` is always 0). An unknown `--hook` key drains stdin and exits 2 with a stderr message. Any thrown error is caught in the generated `main()`, which writes `{ error: true, message, stack }` to stdout and exits 2. A decode failure prints a `TreeFormatter` report to stderr. There is no outcome that maps to exit 2 as a deliberate block.

## Effect usage

Effect v3: the SDK peer-depends on `effect ^3.21.0` (3.21.3 installed), `@effect/platform ^0.96.0` and `@effect/platform-bun ^0.89.0`.[^claude-binary-plugin-repo]

- **Schema**: `Schema.Class` for inputs, events, responses, outcomes, config and state; `Schema.Union` of `Schema.Struct` for outputs; `Schema.optionalWith(..., { default })`; branded ids (`SessionId`, `ToolUseId`, `TranscriptPath`, `NormalizedPath`); decoding with `Schema.decodeUnknownSync` and `ParseResult.TreeFormatter`.
- **Services and layers**: about 18 services, each a `Context.Tag` in `services/` with `*Live` and `*Test` layers: `StdinReader`, `EnvLoader`, `EnvResolver`, `EnvCoordinator`, `EnvBridge`, `EnvWriter`, `SessionStore` (backed by `bun:sqlite`), `GitInfo`, `PlatformInfo`, `ClaudeAccountInfo`, `ShellExecutor`, `CommandRunner`, `MessageRouter`, `Telemetry`, `SidecarConnection` and others. `PluginLive` composes them and `PluginRuntimeServiceLive.run` executes one hook as an `Effect` returning `RunResult`.
- **Runtime**: the generated entrypoint calls `Effect.runPromise(program.pipe(Effect.provide(RuntimeLayer)))` per invocation, then writes JSON with `process.stdout.write`.
- **Errors**: one `Data.TaggedError` per file (`StdinError`, `SchemaValidationError`, `PluginRuntimeError` with a `stage`, `ShellError`, `SidecarError` and others); recovery with `Effect.catchAll`.
- **Bun coupling**: `Bun.stdin.text()`, `Bun.$`, `Bun.connect` (Unix-socket IPC to the OTEL sidecar), `bun:sqlite`, `bun:test`.

For Effect v4, the v3-specific surface in use includes `Context.Tag` services, `Schema.optionalWith`, `ParseResult`, `Effect.catchAll` and the separate `@effect/platform` packages; each would need porting through the effected plugin's guidance rather than copying.

## Building binaries

`ClaudePlugin.build()` delegates to `PluginBuilder.fromConfig` (`src/build/builder.ts`), which:[^claude-binary-plugin-repo]

1. Generates `.plugin-entrypoint.ts`: imports the config and every handler, and a `parseArgs` router over `--hook=<Event>/<name>`, `--cmd=<name>` and `--sidecar`, with a `switch` per hook key that builds the run program.
2. Shells out to `bun build <entry> --compile --outfile <name>.plugin` with `--minify` on by default, `--bytecode` opt-in (with explicit ESM format), and an optional `--target` from `bun-linux-x64`, `bun-linux-arm64`, `bun-linux-x64-baseline`, `bun-linux-x64-musl`, `bun-linux-arm64-musl`, `bun-darwin-x64`, `bun-darwin-arm64` or `bun-windows-x64`. Default is the host platform, and one build produces one binary; there is no multi-target matrix. `compile: false` emits a bundled `.js` instead. `.bun-build` temp files are removed afterwards.
3. Writes `scripts/setup-proxy.sh` and `hooks/hooks.json` into the plugin root, next to the binary.
4. Optionally (`persistLocal`, needs `marketplaceName`) copies the plugin into `${CLAUDE_CONFIG_HOME}/plugins/cache/<marketplace>/<plugin>/<version>`.

Output size: the dogfood plugin's local, untracked `test-plugin.plugin` (darwin arm64, built 2026-04-01) is 63,792,352 bytes, about 61 MiB, for two trivial hooks, because the Bun runtime is embedded. The SDK package itself is built for npm with `@savvy-web/bun-builder` (`BunLibraryBuilder`, `package/bun.config.ts`).

## Wiring into a plugin

`ManifestGenerator.ts` emits one matcher group per handler, with the command `${CLAUDE_PLUGIN_ROOT}/<binary> --hook=<Event>/<name>` and `matcher` set to the handler's `tools` joined with `|`; raw passthrough entries are appended as given.[^claude-binary-plugin-repo] There is no per-platform dispatch. Portability comes from just-in-time compilation: SessionStart hooks route through `scripts/setup-proxy.sh` instead of the binary. Its fast path `exec`s the binary when the binary and `node_modules/` exist. Its slow path buffers stdin, takes a `mkdir` lock, runs `bun install`, rebuilds, and forwards stdin. Its error path writes an `additionalContext` notice to stdout, an error to stderr, and exits 2. Every other event points straight at the binary, on the stated assumption that SessionStart always runs first. The binary is gitignored, and `hooks.json` and the proxy are meant to be committed; the plugin therefore needs Bun and its source on the user's machine. The dogfood plugin's generated `hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/setup-proxy.sh --hook=SessionStart/init" }] }],
    "PreToolUse": [{ "hooks": [{ "type": "command",
      "command": "${CLAUDE_PLUGIN_ROOT}/test-plugin.plugin --hook=PreToolUse/guard" }] }]
  }
}
```

The `${CLAUDE_PLUGIN_ROOT}` reference is unquoted, which the [Claude Code plugin format](claude-code-plugin-format.md) notes `validate` warns about in shell-form hooks.

## Event coverage

26 events have modules: PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, PermissionDenied, Notification, UserPromptSubmit, Stop, StopFailure, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, TeammateIdle, InstructionsLoaded, ConfigChange, CwdChanged, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, Elicitation, ElicitationResult, SessionStart, SessionEnd.[^claude-binary-plugin-repo] Only some have dedicated outcomes (PreToolUse, PostToolUse, SessionStart, Stop and SubagentStop, UserPromptSubmit, PermissionRequest, PermissionDenied, FileChanged and CwdChanged); the rest are passthrough with `NoAction`, and `toResponseForHook` maps only eight event types explicitly.

Against the 33 events in the [Claude Code plugin format](claude-code-plugin-format.md) hooks list, seven are missing: `Setup`, `UserPromptExpansion`, `PostToolBatch`, `MessageDisplay`, `DirectoryAdded`, `PreModelSwitch`, `PostModelSwitch`. Payload field coverage was not compared field by field. Copilot hooks are not modelled at all.

## Staleness

- **Git history**: 148 commits from 2025-12-19 to 2026-09-09. The last five (2026-08-27 to 2026-09-09) are tooling chores (Silk, Biome, editor settings); the last substantive work is the hooks refactor and Effect cleanup specs and plans dated 2026-04-01 and 2026-04-04 under `docs/superpowers/`.[^claude-binary-plugin-repo]
- **Dependencies**: Effect 3.21 and `@effect/platform` 0.96, against pluginfinity's Effect v4; OpenTelemetry SDK 0.212 and 2.5; `@types/node ^20`.
- **Removed CLI still referenced**: `.claude/design/cli.md` says the CLI was removed and the build is programmatic only, and the package has no `bin`. Yet `ProxyTemplate.ts` still runs `bun x claude-binary-plugin build`, so the proxy's slow path would fail, and `docs/08-build-and-distribution.md` still documents the `build` command and its flags.
- **Docs drift**: `docs/` and the `builder.ts` header still mention Zod, `PluginEnv` and `ClaudeBinaryPlugin.create`, all replaced by Effect Schema and the `PluginConfig` and `ClaudePlugin` API.
- **Tests**: 67 `bun:test` files under `package/__tests__/` (about 1,100 `test(` calls) mirroring `src/`, using Test layers and the fluent `ClaudePlugin.test()` tester (`.withOptions().withState().withPreToolUseInput().runHook()`), plus the dogfood plugin's tests. Nothing runs a compiled binary end to end against Claude Code.
- **Release**: Changesets with a reusable `spencerbeggs/.github` release workflow publishing the SDK to npm and GitHub Packages. Plugins are not distributed: binaries are built on the user's machine through the proxy.

## Fit with pluginfinity

Observations only; nothing here is decided.

- **Core** ([module](../modules/core.md)) is platform-free. The per-event input schemas, branded ids and outcome classes are pure Schema and would fit a host-neutral hook model there, but the snake-case wire shapes and `toResponse()` are Claude Code facts, which pluginfinity keeps in targets.
- **Targets** ([module](../modules/targets.md)) is where per-host event lists, payloads, output shapes and exit-code meanings would live as data. claude-binary-plugin has only Claude Code, with no capability table; Copilot's differently cased events and exit-code rules (see [Copilot plugin format](copilot-cli-plugin-format.md)) have no counterpart.
- **Engine** ([module](../modules/engine.md)) maps to `HookExtractor`, `ManifestGenerator` and `EntrypointGenerator`: reading a source and writing `hooks.json` per host into `builds/<target>/`. The `bun build --compile` call, the proxy and the cache sync are platform work that core and targets exclude.
- **Runtime library**: the hook runtime (stdin decode, env and state persistence, `bun:sqlite`, OTEL sidecar) runs inside the user's plugin, not inside a build tool. pluginfinity's [non-goal](../project.md) of no library API beyond `defineConfig` leaves no current home for it.
- **Distribution**: build-on-first-SessionStart requires Bun and the plugin's source and `node_modules` on every user machine, and assumes event ordering. pluginfinity's one-way build into self-contained per-host folders points instead toward prebuilt per-platform binaries plus a dispatch step, which claude-binary-plugin does not have.
- **Reusable as is**: the three-file authoring shape, typed outcomes narrowed per event, `InferHandlers` from config statics, Test layers for each service, and the fluent tester.

[^claude-binary-plugin-repo]: <https://github.com/spencerbeggs/claude-binary-plugin/tree/1348b7215e295eaf26d482e233175b557bebf972>
[^owner-direction]: conversation with the repository owner, 2026-10-02
