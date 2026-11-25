---
type: Module
title: pluginfinity companion plugin
description: plugins/pluginfinity, the agent plugin that teaches how to author plugins for pluginfinity; built by pluginfinity and the successor to plugin-bot.
x-okfit-kind: plugin
resource: ../../plugins/pluginfinity
status: draft
tags:
  - portability
  - dx
sources:
  - id: skill
    resource: ../../plugins/pluginfinity/skills/pluginfinity/SKILL.md
    title: The pluginfinity skill
  - id: hooks-reference
    resource: ../../plugins/pluginfinity/skills/pluginfinity/references/hooks.md
    title: The hooks reference
  - id: native-hooks
    resource: ../../plugins/pluginfinity/skills/native-hooks/SKILL.md
    title: The native-hooks skill
  - id: skill-authoring
    resource: ../../plugins/pluginfinity/skills/skill-authoring/SKILL.md
    title: The skill-authoring skill
  - id: agent-authoring
    resource: ../../plugins/pluginfinity/skills/agent-authoring/SKILL.md
    title: The agent-authoring skill
  - id: persuasion
    resource: ../../plugins/pluginfinity/skills/persuasion/SKILL.md
    title: The persuasion skill
  - id: package-manifest
    resource: ../../plugins/pluginfinity/package.json
    title: Companion plugin tracking package
  - id: plugin-engineer
    resource: ../../plugins/pluginfinity/agents/plugin-engineer.md
    title: The plugin-engineer agent
  - id: recipes-test
    resource: ../../packages/pluginfinity/__test__/recipes.test.ts
    title: The recipe drift test
  - id: plugin-engineer-test
    resource: ../../packages/pluginfinity/__test__/plugin-engineer.test.ts
    title: The plugin-engineer build test
generated:
  by: okfit/claude-code
  at: 2026-11-25T22:36:21Z
x-okfit-integrity:
  generated:
    body: d654927214f676c5
---

# pluginfinity companion plugin

## What it is

`plugins/pluginfinity/` is the agent plugin that ships alongside the CLI. It will hold the knowledge of how to author agent plugins (manifests, skills, agents, hooks, MCP wiring) and how to structure a plugin source for pluginfinity. It is the successor to plugin-bot and covers much of what plugin-bot does, but it is a new plugin: plugin-bot stays in the bot repository ([decision](../decisions/pluginfinity-is-a-cli-application.md)).

## Shape

- `package.json` is a private tracking package, `@pluginfinity/ai-plugins`, that is never published to npm. A changeset against it bumps its version, which the build copies into each generated manifest, and CI cuts a GitHub-only release that the marketplaces track; `.changeset/config.json` lists both built manifests as its version files.[^package-manifest]
- It depends on the CLI as `"pluginfinity": "workspace:*"` in `devDependencies`, and its `build` and `validate` scripts call the bin shim directly, as `pluginfinity build` and `pluginfinity validate`.[^package-manifest] The [carrier's](pluginfinity.md) bin points at its source file, so pnpm creates the shim on every install, `--ignore-scripts` included, and it runs from source with no package built.
- Once there is a source to build, it follows the target layout in [the roadmap](../roadmaps/pluginfinity-first-release.md): host-neutral source at the root, `pluginfinity.config.ts`, and generated, committed output under `builds/<id>/`.

## Status

The `pluginfinity` skill, the first of seven, teaches an agent to author and build a plugin with pluginfinity: the source layout and config, skill and agent frontmatter, `targets` blocks and host blocks, hooks, what each host gets, and every finding with its fix, split into references the skill loads on demand.[^skill] It is built with pluginfinity into `builds/claude/` and `builds/copilot/`, which are committed and skipped by Biome and markdownlint. plugin-bot's authoring skills have been rewritten for one source; its host-reference skills are left for a later release.

The hooks material is split by who needs it: the `pluginfinity` skill's `references/hooks.md` holds the config (entries, handlers, how each kind runs, the failure policy, run-time matchers, what ships), the `bash-hooks` skill's `references/library.md` and `references/testing.md` hold the bash library and the bats helper, and the `native-hooks` skill's `references/api.md` holds the native library. Before the split one page held the first three. The same skill's references also hold `servers.md`, `logging.md` (the one place the logging standard is described; the other pages link to it) and session env in three pages: the contract, testing and debugging, and migrating. Together they cover more than declaring hooks: the [hook library](../decisions/hook-library-is-build-injected.md) a script sources and how to read an event and respond on both hosts, with the `tool_input` key aliases and the response table. It also covers what happens when a hook fails, testing hooks with the bats helper, what ships, and which events each host has. It tells authors to assign `hook_input` to a variable first, and to turn on `PLUGINFINITY_DEBUG=1` to see each hook's raw input and its outcome in `debug.log`.[^hooks-reference] The same references now cover `failClosed`, the one [logging standard](../decisions/one-logging-standard.md), the `hook_allow` order (`[reason] [updated-input-json]`), `hook_relay` and `hook_envelope`, [monitors](../decisions/monitors-are-a-component.md) with a recipe and the `run_script` and `run_monitor` bats helpers, the `{{tool <name> | <fallback>}}` form, and a per-skill `targets` recipe for host-specific skills. `migrating-hooks` keeps the reason a plugin-bot `emit_allow` carried. `references/monitors.md` is the monitor reference.

## The plugin-engineer agent and its skills

`agents/plugin-engineer.md` is an agent that writes, tests and migrates hooks and plugin scripts in a pluginfinity plugin, and converts plugin-bot-era plugins to the hook library. It is declared with `model: inherit`, so it runs on whatever model the session uses. Its loop is bats-first: a fixture, a failing `run_hook` test for both targets, the script, the config entry, a build, then bats green on both targets and a clean `build --check`. It never edits `builds/` and never vendors the library or writes `hooks.json`.[^plugin-engineer]

On Claude Code it preloads four skills through its `skills:` list: `pluginfinity`, `bash-hooks`, `hook-events` and `persuasion`, the last because nearly every hook it writes carries text aimed at an agent. Copilot cannot preload skills, so a `pluginfinity:only copilot` block adds a "Read first" section that tells the agent to read the same four before acting. The build test requires the preload list and no read-first block on Claude, and the read-first block on Copilot.[^plugin-engineer-test]

The `pluginfinity` skill's `references/session-env.md` teaches [session env](../decisions/session-env-is-declared-and-resolved-once.md): the `env` block, the precedence chain, readers, `hook_env_set`, the setup contract, testing and a migration recipe. Its other references cover `{{skill_dir}}`, the SessionStart matcher widening, `pluginfinity logs` and the new build notes, and the agent applies them when a plugin needs per-session values.

The six skills beside the `pluginfinity` skill are:

- `bash-hooks` (formerly `hook-authoring`): writing a hook as a bash script on the hook library, the companion to `native-hooks`: when to choose it, the bats-first loop and the rules the library depends on, with a `references/recipes.md` of five recipes (command guard, startup context, post-edit reaction, stop gate, subagent context). Its `references/scripts.md` is the former `plugin-scripts` skill: server launchers, scripts a skill runs, calling CLIs without leaking credentials, state, session env, logging and the `run_script` and `run_monitor` bats helpers. `native-hooks` has the matching `references/system.md` for a compiled hook, whose `gh` and data-directory snippets were compiled and run once in the example plugin.
- `hook-events`: the contract the bash and native skills share: the answers a hook can send with each library's spelling, what each host honours on each event, the JSON Schema of every event's input and output, and the measured host differences, with a `references/events.md`.
- `native-hooks`: writing a hook as a compiled program with the [Zig hook library](zig-hooks.md) and a `binary` entry: setup, the write-test-build loop, the rules a native hook keeps, and references for the library's API, the Zig 0.17 that differs from older Zig, and five recipes a test holds equal to `zig/examples/recipes`. It is experimental, and the plugin-engineer agent does not preload it.[^native-hooks][^recipes-test]
- `skill-authoring`: writing a `SKILL.md`: the name and description rules, how a skill is triggered on each host, the body and its references, and what the Copilot build does with each field. Its `references/writing.md` covers content quality and scripts an agent can drive, and `references/evals.md` covers trigger and output evals, replacing plugin-bot's separate `skill-evals` skill. `scripts/trigger-harness.sh` runs a query set through `claude -p` and prints each query's trigger rate; it was checked on one positive and one negative query against this plugin's `hook-events` skill.[^skill-authoring]
- `agent-authoring`: writing `agents/<name>.md`: the description, tools, the skills preload, the system prompt and its boundaries section, the fields a plugin agent cannot use, and what the Copilot build keeps, translates or drops. It declares a `paths` glob for agent files.[^agent-authoring]
- `persuasion`: the wording of text meant to change what an agent does, in hook context, deny reasons, skill bodies and agent prompts: four tiers of force with the plain one as the default, XML tags for injected text, and what each hook slot delivers on each host. All three came from plugin-bot and were rewritten for the hook library and the two-host build; of the three the plugin-engineer agent preloads only `persuasion`.[^persuasion]

`bash-hooks`, `native-hooks`, `skill-authoring` and `agent-authoring` declare `paths` globs. On Claude those only limit when the skill may be activated automatically; opening a matching file does not load it ([measured](../measurements/hook-library-live-2026-10-03.md)). Copilot has no `paths`, so the build writes the globs into the skill description. The agent body says to read the right skill before touching a hook or script rather than relying on `paths`.

One test keeps the content from drifting. The recipe drift test ties each recipe in `references/recipes.md` to a real hook in the [dogfood fixture](dogfood.md): the recipe's config entry must appear in dogfood's `pluginfinity.config.ts`, and its script and bats test must match dogfood's byte for byte, so every recipe is already tested on both hosts.[^recipes-test] The `migrating-hooks` skill and its mapping-table test were removed once the plugin-bot-era plugins had moved to the hook library. Recipe code blocks keep hard tabs, so the repository's markdownlint config sets MD010 with `code_blocks: false`; lint-staged's `--fix` had rewritten the tabs and broken the byte comparison.

## Boundary with dogfood

The companion uses only the CLI features a real plugin needs. CLI features it has no use for are exercised by the [dogfood fixture](dogfood.md) instead, never by adding them to the companion for coverage.

[^package-manifest]: `../../plugins/pluginfinity/package.json`
[^hooks-reference]: `../../plugins/pluginfinity/skills/pluginfinity/references/hooks.md`
[^skill]: `../../plugins/pluginfinity/skills/pluginfinity/SKILL.md`
[^plugin-engineer]: `../../plugins/pluginfinity/agents/plugin-engineer.md`
[^recipes-test]: `../../packages/pluginfinity/__test__/recipes.test.ts`
[^plugin-engineer-test]: `../../packages/pluginfinity/__test__/plugin-engineer.test.ts`
[^native-hooks]: `../../plugins/pluginfinity/skills/native-hooks/SKILL.md`
[^agent-authoring]: `../../plugins/pluginfinity/skills/agent-authoring/SKILL.md`
[^persuasion]: `../../plugins/pluginfinity/skills/persuasion/SKILL.md`
[^skill-authoring]: `../../plugins/pluginfinity/skills/skill-authoring/SKILL.md`
