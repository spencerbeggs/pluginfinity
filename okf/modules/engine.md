---
type: Module
title: "@pluginfinity/engine"
description: The pluginfinity logic shared by every front end; today config discovery, loading and strict decoding, the typed config and build errors, the doctor program, build and validate for manifests, hooks, skills, agents and MCP and LSP servers, the shipped-file planner, monitors, the injected hook, server, log and monitor libraries, the reconciling emit, and ENGINE_VERSION.
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
  - id: logs
    resource: ../../packages/engine/src/logs.ts
    title: Reading plugin logs, parsing a line and following a file by offset
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
  - id: hook-lib
    resource: ../../packages/engine/hook-lib/hook.sh
    title: The host-neutral bash hook library
  - id: hook-lib-embed
    resource: ../../packages/engine/scripts/embed-hook-lib.ts
    title: The script that embeds hook-lib/*.sh as generated TypeScript
  - id: hook-lib-injection
    resource: ../../packages/engine/src/hook-lib.ts
    title: hookLibFiles, renderHostFile and HOOK_LIB_DIR
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
  - id: servers
    resource: ../../packages/engine/src/servers.ts
    title: renderServers, serverFiles and the MCP and LSP encoders
  - id: server-lib
    resource: ../../packages/engine/server-lib/server.sh
    title: The POSIX sh server library launchers source
  - id: server-lib-injection
    resource: ../../packages/engine/src/server-lib.ts
    title: serverLibFiles and SERVER_LIB_DIR
  - id: log-lib
    resource: ../../packages/engine/log-lib/log.sh
    title: The POSIX sh logging library
  - id: monitor-lib
    resource: ../../packages/engine/monitor-lib/monitor.sh
    title: The POSIX sh monitor library
  - id: monitors
    resource: ../../packages/engine/src/monitors.ts
    title: targetMonitors and renderMonitors
  - id: hook-output
    resource: ../../packages/engine/src/hook-output.ts
    title: The hook-output-ignored scan
  - id: notes
    resource: ../../packages/engine/src/notes.ts
    title: BuildNote, BUILD_NOTE_KINDS and sortNotes
  - id: tokens
    resource: ../../packages/engine/src/tokens.ts
    title: renderTokens, TokenContext and TokenProblem
  - id: body
    resource: ../../packages/engine/src/body.ts
    title: applyHostBlocks and the fenced-line scan
generated:
  by: okfit/claude-code
  at: 2026-10-07T03:22:43Z
  body_sha256: 552ee90f6d35c51560f3b8850a6c367d3abd6a2d8625498d6af648d34ab48aa2
---

# @pluginfinity/engine

## What it is

`packages/engine/` computes everything a front end would otherwise have to implement itself ([decision](../decisions/pluginfinity-ships-as-a-carrier-package.md)).[^package-manifest] The [CLI](cli.md) renders its results, and so will a future MCP front end. Each operation is one program that returns a typed result or fails with a typed error, and `ENGINE_VERSION` is the version to compare when asking whether two reports came from the same build.

## What it does today

- **Discovery.** `ConfigDiscovery.nearest` walks up from a start directory and returns the first `pluginfinity.config.{ts,mts,js,mjs}` it finds. It stops after the first directory that contains `.git`. `ConfigDiscovery.all` returns every config below a directory and never descends into `node_modules`, `builds` or `.git`. Two config files in one directory fail as `ConfigAmbiguous`.[^discovery]
- **Loading.** `ConfigLoader.load` imports the file through jiti with its module and filesystem caches off, takes the default export, and decodes it strictly against `PluginfinityConfig` from [targets](targets.md). An unknown top-level key fails as `UnknownTarget`, and a config that decodes but enables no target fails as `ConfigInvalid`.[^loader] The shape is the [config interface](../interfaces/config.md).
- **Selection.** `ConfigSelection` is one of nearest, all, or an explicit file. `preparePlugins` selects, loads, and checks that each `--target` asked for is enabled (`TargetNotEnabled` otherwise). It is the front half `build` and `validate` share.[^selection]
- **Errors.** `ConfigNotFound`, `ConfigAmbiguous`, `ConfigLoadFailed`, `ConfigInvalid`, `UnknownTarget` and `TargetNotEnabled` together form `ConfigError`. Each one carries a path, a message and a one-line remediation hint, so a front end can render it for any audience. `PackageVersionMissing`, `HookEventUnsupported`, `HookScriptInvalid`, `ShippedFileInvalid`, `PathConflict`, `ComponentsInvalid` (holding one `ComponentInvalid` per file), `BuildStale` (with one `TargetDrift` per drifted target) and `HostRejected` form `BuildError`, with the same three parts. `ShippedFileInvalid` names the file, what references it (`mcpServers.<name>`, `lspServers.<name>`, either prefixed `<target>.` for a server a target override sets, or `files`) and a `problem`: `missing`, `not-executable`, `directory`, `outside-root` or `not-normal`. `NotImplemented` marks an operation that exists in the command surface but is not built yet, such as `init`.[^errors]
- **Manifests.** `renderManifest` builds a target's manifest from the config, the target's name override and the `package.json` version, and any server maps the target places in its manifest, through one function per manifest format, cut to the target's key allowlist in its order.[^manifest]
- **Emit.** `planEmit` compares the files a build produces with what a build directory holds, by bytes and, for a file copied with its source mode, by its executable bit only (a generated file's mode is never compared, so permission churn from git hooks or a umask is not drift), and returns an `EmitPlan` of added, changed, removed and unchanged paths. `applyEmit` stages added and changed files in a sibling temporary directory, then renames each into place, deletes removed files and stray empty directories, prunes the directories that leaves empty, and only then renames each staged file into place, so a path that changes only by case, or turns from a file into a directory, settles in one build. Unchanged files are never written, so their mtimes stay, and generated files are `0644`.[^emit]
- **Hooks.** `targetHooks` applies a target's per-event overrides to the base `hooks` and maps each event to the target's name. An event the target lacks is omitted, and listed in `omitted`, when every entry sets `fallback: "omit"`, and otherwise fails the build with `HookEventUnsupported`. `hookCommand` renders an entry as a shell command at the target's plugin root, through `bash` unless `scripts.invoke` is `"exec"`; `hookExec` renders a script entry in exec form, `command` and `args` with no shell, which Claude Code's hooks file uses, as `env K=V… bash <path> …`, and `renderHooks` writes the hooks file through one renderer per hooks format.[^hooks] Each target ships the source `hooks/` directory whole, so a script can source its helpers, except scripts that only another enabled target's hooks run. That set is computed over every enabled target, so what a target ships does not depend on which targets a run selects, and `build --check --target <id>` after a full build is clean. Copied files keep their source mode. A missing script, or one without the executable bit under `exec`, is `HookScriptInvalid`. A source file on a path the build generates, such as `hooks/hooks.json` on Claude Code, or anywhere under the reserved `hooks/lib/pluginfinity/`, is `PathConflict`.[^operations] `entryEnv` gives every entry `PLUGINFINITY_EVENT` (the Claude event name, because a camelCase Copilot payload has no `hook_event_name`), `PLUGINFINITY_FAIL_CLOSED=1` when the entry sets `failClosed`, and `PLUGINFINITY_MATCHER` on an event the target's `hooks.matcherIgnored` lists, where the build drops the host `matcher` and the library applies it at run time. Claude Code carries them in the exec-form `env` of a script entry or an `export` before a command entry, Copilot only in its `env` field. Under `scripts.invoke` `"exec"` a script path containing `=` is `HookScriptInvalid` with the problem `equals-in-path` ([decision](../decisions/entry-facts-travel-as-env.md)).
- **Hook library.** `hook-lib/hook.sh` is the host-neutral bash library hook scripts source: Bash 3.2 compatible, `jq` at run time (with `cat`, `mktemp`, `rm`, `date`, `mkdir`, `basename` and `dirname`), one response per hook, [failing open](../decisions/hooks-fail-open.md). Its bats suite is `__test__/hook-lib/hook.bats`, run by `pnpm test:bats`, and `pnpm test:bats:compat` runs it under the system bash. The sources are embedded into `src/hook-lib.generated.ts` by `pnpm --filter @pluginfinity/engine hook-lib:embed`, so a build needs no asset on disk, and a test fails when the two disagree. `hookLibFiles` writes the embedded files to `hooks/lib/pluginfinity/` in every target that has hooks, beside a generated `host.sh` that sets `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB_VERSION` (the engine version). A target with no hooks gets none of it, and `build --check` treats the files like any other output. `hook_input` reads `tool_input` keys by their Claude names on both hosts, and with `PLUGINFINITY_DEBUG=1` the library logs each hook's raw input and, from its exit trap, one `outcome:` line naming the response it sent (or `none`, or a `fail-closed` one) with a non-zero exit code appended, through the [shared log library](../decisions/one-logging-standard.md). Garbage or empty stdin reads as `{}`, and `hook_event` returns 1 when the event is unknown. `hook_require_input`, called at top level, ends a hook that got no input (an `exit` in a subshell would end only the subshell). `hook_allow` takes `[reason] [updated-input-json]`. `hook_project_dir` is where the call runs and is never empty: an absolute input `cwd` resolves to its nearest `.git` ancestor, else the `cwd` itself, and a relative `cwd` is ignored; with no usable `cwd` it is `CLAUDE_PROJECT_DIR` on Claude, else `$PWD` walked up to a git root, else `$PWD`, and on Copilot `$PWD` unchanged. `hook_session_dir` is the session's project. `hook_envelope claude` and `hook_relay` pass a CLI-owned decision through, with precedence permission, block, context, system message, then no-op, and log a dropped field to the debug log. `hook_tool_name` reads the per-target `tools.sh` the build writes beside the hook library, which also lists what the target builds (`_PF_HAS_SKILLS`, `_PF_HAS_AGENTS`, `_PF_HAS_MONITORS`, `_PF_HAS_SERVERS`). `hook_has <monitor|skill|agent|server> <name>` returns 0 or 1 from those lists (2 and a log line for an unknown kind), and `hook_tool_prefix <server>` prints `mcp__plugin_<claude plugin>_<server>__` on Claude and `<server>-` on Copilot, returning 1 for an undeclared server. `hook_cd_project` changes into `hook_project_dir`, writing nothing to stdout, and logs and returns 1 when it cannot. The reasons are in [the decision](../decisions/hook-library-is-build-injected.md), and what a live run on both hosts showed is in [the measurement](../measurements/hook-library-live-2026-10-03.md).[^hook-lib][^hook-lib-embed][^hook-lib-injection]
- **Skills.** `readSkills` reads every `skills/<name>/SKILL.md`, parses its frontmatter with `@effected/yaml` and decodes it strictly against core's `SkillFrontmatter`. A YAML error is reported at its file line and column, and a name that differs from the directory or a `targets` key that is not a known target fails too, all as `ComponentInvalid`, collected into `ComponentsInvalid`. `mapFrontmatter` applies a target's field map and the component's `targets` block, `applyHostBlocks` keeps or strips each host block, and `renderSkill` writes `SKILL.md` with `name` always set and its `.md` support files processed and the rest copied, every file keeping its source mode. A built `description` over 1,024 characters, the Agent Skills limit Copilot enforces, fails for that target.[^skills]
- **Body tokens and links.** After host blocks, `renderTokens` rewrites `SKILL.md`, every other `.md` file in a skill directory and an agent body for one target; frontmatter, scripts and other files are untouched ([decision](../decisions/body-tokens-and-links-are-built-per-target.md)). A token is `{{tool <name>}}`, `{{agent <name>}}`, `{{skill <name>}}` or `{{plugin_root}}` on one line (a `{{tool <name> | <fallback>}}` writes the fallback text when the target cannot spell the tool; the fallback may not contain `{` or `}`, and only tool tokens take one; a backticked name, ``{{tool `Name`}}`` or ``{{tool `Name` | <fallback>}}``, renders the spelling in a code span where the target spells it and the plain fallback elsewhere, and other kinds reject backticks), replaced everywhere, code included, and spelled from the target's `tools.runtime`, `agents.id`, `skills.invoke` and `pluginRoot.body`. A `{{` whose first word is not one of those kinds is text, and `\{{` drops its backslash only before a token. An inline `[text](pluginfinity://skill/<skill>[/<path>][#anchor])` or `[text](pluginfinity://agent/<agent>)` outside fenced and inline code is built in the target's `references.style`: a path under the body root, anchor kept, or prose, anchor dropped. Any other `pluginfinity://` outside code, in any case, is a problem. Problems are keyed by file line and become a `ComponentInvalid` naming the target; `renderSkill` fails with a `ComponentsInvalid` when several files of one skill have them. `renderSkill` and `renderAgent` take a required `TokenContext`, which `planPlugin` builds per target from the skills and agents that target builds, every file of those skills and the plugin's own MCP servers. An indented code block is not treated as code, nor an inline code span across two lines.[^tokens][^body]
- **Agents.** `readAgents` reads every `agents/<name>.md` the same way, and its `name` must equal the file stem. `renderAgent` writes `<agents.dir>/<name><agents.suffix>` through the target's agent field map; a field degraded to a body section, such as `skills` on Copilot, is appended as a level-two heading and a list marked like the body's first list.[^agents]
- **Components share one reader.** A frontmatter value plain YAML would cut short at `#` is refused, since Claude Code's reader keeps the text and every YAML parser drops it. Decoded fields keep the author's key order, and when a target's fields come out exactly as they went in, the author's frontmatter text is written unchanged, comments and folding included. Every component problem in a plugin is collected into one `ComponentsInvalid`, so a single build reports them all, and a host-block problem, wrong for every target, is reported once.[^component]
- **Translation tables.** A `translate` entry maps a value through the target's `tools.names` (de-duplicated, with `drop` leaving a tool out and a Claude `mcp__<server>__<tool>` name rewritten to the target's MCP spelling). A plugin's own `mcp__plugin_<plugin>_<server>__<tool>`, where `<plugin>` is the plugin's Claude name and `<server>` an MCP server that target declares, is rewritten the same way on a target that drops unlisted names and kept as written on Claude Code; any other `mcp__plugin_…` name is dropped there. A `translate` entry can also map a value through the target's `models` table, where `drop` leaves the field out, as Copilot does for `inherit`.[^frontmatter]
- **Build notes.** `mapFrontmatter` records each field it drops or degrades and each tool it cannot spell, `targetHooks` lists each omitted event, `renderServers` each dropped LSP field, `ignoredOutput` each hook script whose output the host ignores (a best-effort scan of the script text), and `renderMonitors` each omitted monitor. `planPlugin` turns them into `BuildNote`s (`target`, `path`, `kind`, `name`), with `kind` one of `BUILD_NOTE_KINDS` (`dropped`, `degraded`, `tool-dropped`, `hook-matcher-runtime`, `hook-output-ignored`, `hook-omitted`, `monitor-omitted`) and `path` the component's source path or `config`, and `sortNotes` de-duplicates and sorts them, `config` last. A value a translation table drops, such as `model: inherit`, gets no note. Every `TargetBuild` and `TargetValidation` carries its notes, which never fail anything ([decision](../decisions/build-notes-cover-hooks-and-monitors.md)).[^notes]
- **`build` and `validate`.** `build` renders every selected target into `<plugin root>/builds/<id>/`; with `check` it writes nothing and fails with `BuildStale` on any difference. `validate` requires current builds, then runs each host's check unless `skipHosts`: `claude plugin validate`, and for Copilot, which has no validate command, a `--plugin-dir` plugin listing that must load the build under its manifest name and version.[^operations]
- **Logs.** `logs.ts` reads what the injected log library writes: `parseLogLine` splits a `<ts> [<host>] <component>/<script>: <message>` line (a line that does not parse is carried as raw), `listLogPlugins` and `configPluginNames` name the plugins to read (every directory under the state directory, or the names the config's targets publish under), `readLog` returns a file's last lines, and `readLogFrom` returns the complete lines appended after a byte offset, restarting from the top when the file shrank. The state directory is passed in; the engine reads no `process`.[^logs]
- **Servers.** `renderServers` merges each target's MCP and LSP servers (base, then the target's overrides by name) and writes them through one encoder per format, total over `MCP_FORMATS` and `LSP_FORMATS`. It rewrites `${PLUGIN_ROOT}` to the target's spelling only in the fields the placeholder is documented in (a local MCP server's `command`, `args`, `env` values and `cwd`; an LSP server's `command`, `args`, `env` values and `workspaceFolder`), so remote MCP servers, `initializationOptions` and `settings` pass through untouched. LSP fields go through the target's field map. Each encoded config goes where the target's `placement` says: a file, or the `manifest` map of `ServerRender` keyed by manifest key, which `planPlugin` passes to `renderManifest` so Claude Code's servers land in `plugin.json` ([decision](../decisions/claude-servers-go-inline-in-the-manifest.md)). Every local server's `env` gains `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB`. On Copilot each local MCP server is written with `"type": "stdio"` and `http` becomes `streamable-http`. On Claude any MCP `cwd` is a `ComponentInvalid` issue, since Claude ignores it, and so is an LSP field a target leaves unresolved, and a host root spelling or brace-less `$PLUGIN_ROOT` in a root field. Issue keys name the server and field, prefixed with the target for a server a target override sets, such as `copilot.lspServers.<name>.settings`; those issues join the skill and agent failures in one `ComponentsInvalid`.[^servers]
- **Shipped files.** `planPlugin` ships, per target, the union of the hook files above, every file `serverFiles` finds after `${PLUGIN_ROOT}/` in that target's merged servers (the same documented fields, and not in an LSP field the target leaves unresolved), and every file `files` lists, each once. A reference ends at whitespace, a quote, a shell metacharacter, `:` or `,`. A server-named path with an empty, `.` or `..` segment is `ShippedFileInvalid` `not-normal` (one trailing `/` is allowed); one that does not exist is `missing`; one whose real path leaves the plugin is `outside-root`; a whole `command` that is a directory is `directory`, and one without the executable bit is `not-executable`. A directory a server names, like a `files` directory, is expanded to every file under it, through the same code, and each one's real path must stay inside the plugin. A shipped file on a generated path, under `lib/pluginfinity/` or `hooks/lib/pluginfinity/`, or on the file an `InManifest` server placement reserves (Claude Code's `.mcp.json` and `.lsp.json`), is `PathConflict`.[^operations]
- **Server library.** `server-lib/server.sh` is the POSIX `sh` library launchers source. It is embedded into `src/server-lib.generated.ts` by the same embed script as the hook library, and `serverLibFiles` writes it to `lib/pluginfinity/server.sh` in every target with at least one local server (a stdio MCP server or any LSP server). It writes nothing to stdout. It provides `server_host`, `server_plugin_root`, `server_project_dir`, `server_exec_bin <bin> <package> [--install <package>] [args]`, `server_log` and `server_debug`, which log through the [shared log library](../decisions/one-logging-standard.md); `--install`, only directly after the two positionals, changes the package the install hint names while the runner still runs `<package>`. When the bin is not installed, the fallback runs `<package>` with the project's package manager (`pnpm dlx`, `yarn dlx`, `bunx` or `npx --yes`), because npm 11 refuses to run in a project whose `devEngines.packageManager` names another manager. The manager is the `devEngines.packageManager` name (object, or first array entry; needs `jq`), else `packageManager`, else a lockfile, else npm, and a declared manager the library does not know falls through to the lockfiles and then npm; a manager missing from `PATH`, or no project directory, means `npx --yes`. Its bats suite is `__test__/server-lib/server.bats`, run by `pnpm test:bats`, and `pnpm test:bats:compat` runs it under `/bin/sh`. The reasons are in [the decision](../decisions/server-launchers-ship-by-discovery-and-files.md).[^server-lib][^server-lib-injection]
- **Monitors.** `targetMonitors` merges the base `monitors` with the target's own, and `renderMonitors` writes the target's monitors file from its `monitors` placement: for Claude Code, `monitors/monitors.json`, an array of `{name, command, description, when?}`, each command carrying `PLUGINFINITY_MONITOR=<name>`: a script monitor is written `PLUGINFINITY_MONITOR='<name>' bash "${CLAUDE_PLUGIN_ROOT}/<script>" …` and a command monitor `export PLUGINFINITY_MONITOR='<name>'; <command>`. A target with no monitors notes each as `monitor-omitted` and ships neither file nor script. Monitor scripts and the files a monitor `command` names ship only to a target that builds monitors, and a source `monitors/monitors.json` is `PathConflict` with reason `reserved-monitors-file` whenever the target builds monitors (set at base or in the target's override), whether `files` ships it or not; Copilot is unaffected, and a plugin with no `monitors` field still ships such a file ([decision](../decisions/monitors-are-a-component.md)).[^monitors]
- **Log and monitor libraries.** `log-lib/log.sh` and `monitor-lib/monitor.sh` are POSIX `sh` libraries embedded and written like the others. `libFiles` in `lib-files.ts` writes `lib/pluginfinity/log.sh` and `host.sh` into every target, and `monitor.sh` into a target with monitors. A script sources `log.sh` by setting `_pf_log_dir` to its directory and calls `script_log` and `script_debug`; a monitor sets `_pf_lib_dir` (or `_pf_log_dir`) and uses `monitor_every`, `monitor_notify` and `monitor_log`. `monitor_notify` inside a subshell cannot tell the loop that stdout closed, and `PLUGINFINITY_MONITOR_MAX_TICKS` is a contract every monitor honours, node command monitors included: stop after that many polls. `monitor_once` keys its marker on `CLAUDE_CODE_SESSION_ID`, then `CLAUDE_SESSION_ID`, then `$PPID`. Logs go to `error.log`, and to `debug.log` under `PLUGINFINITY_DEBUG=1`, in one line format ([decision](../decisions/one-logging-standard.md)). Their bats suites are `__test__/log-lib` and `__test__/monitor-lib`.[^log-lib][^monitor-lib]
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
[^logs]: `../../packages/engine/src/logs.ts`
[^manifest]: `../../packages/engine/src/manifest.ts`
[^emit]: `../../packages/engine/src/emit.ts`
[^hooks]: `../../packages/engine/src/hooks.ts`
[^hook-lib]: `../../packages/engine/hook-lib/hook.sh`
[^hook-lib-embed]: `../../packages/engine/scripts/embed-hook-lib.ts`
[^hook-lib-injection]: `../../packages/engine/src/hook-lib.ts`
[^skills]: `../../packages/engine/src/skills.ts`
[^agents]: `../../packages/engine/src/agents.ts`
[^component]: `../../packages/engine/src/component.ts`
[^frontmatter]: `../../packages/engine/src/frontmatter.ts`
[^operations]: `../../packages/engine/src/operations.ts`
[^servers]: `../../packages/engine/src/servers.ts`
[^server-lib]: `../../packages/engine/server-lib/server.sh`
[^server-lib-injection]: `../../packages/engine/src/server-lib.ts`
[^notes]: `../../packages/engine/src/notes.ts`
[^tokens]: `../../packages/engine/src/tokens.ts`
[^body]: `../../packages/engine/src/body.ts`
[^log-lib]: `../../packages/engine/log-lib/log.sh`
[^monitor-lib]: `../../packages/engine/monitor-lib/monitor.sh`
[^monitors]: `../../packages/engine/src/monitors.ts`
