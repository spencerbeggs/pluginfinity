# pluginfinity

pluginfinity is a CLI that builds one host-neutral agent-plugin source into every host's plugin format (Claude Code, GitHub Copilot), and this repository also hosts its companion plugin (the successor to plugin-bot, which stays in the bot repository) and a dogfood fixture plugin. Project knowledge lives in the `okf/` bundle; this file only routes into it.

- Bundle map → `okf/index.md` — Load when: looking for where a topic is documented.
- Purpose, boundaries and non-goals → `okf/project.md` — Load when: starting work or deciding whether something is in scope.
- Plan and phases → `okf/roadmaps/pluginfinity-first-release.md` — Load when: picking up the next piece of work, or designing the config, targets or commands.
- Why a standalone CLI → `okf/decisions/pluginfinity-is-a-cli-application.md` — Load when: tempted to add a public library API or move code into the `@effected/*` kit.
- Why the carrier split → `okf/decisions/pluginfinity-ships-as-a-carrier-package.md` — Load when: adding a package, adding a dependency edge between packages, or deciding where code belongs.
- Why the name pluginfinity → `okf/decisions/pluginfinity-name.md` — Load when: naming a package, bin, env var or config file.
- Commands, flags and exit codes → `okf/interfaces/cli.md` — Load when: adding or changing a command or flag, or deciding what exit code or output a failure gets.
- Config file → `okf/interfaces/config.md` — Load when: changing the `pluginfinity.config.ts` shape, discovery or loading, or `defineConfig`.
- Carrier package → `okf/modules/pluginfinity.md` — Load when: working under `packages/pluginfinity/`.
- CLI front end → `okf/modules/cli.md` — Load when: working under `packages/cli/`.
- Engine → `okf/modules/engine.md` — Load when: working under `packages/engine/`.
- Targets → `okf/modules/targets.md` — Load when: working under `packages/targets/`.
- Core → `okf/modules/core.md` — Load when: working under `packages/core/`.
- Companion plugin → `okf/modules/pluginfinity-plugin.md` — Load when: working under `plugins/pluginfinity/`.
- dogfood fixture → `okf/modules/dogfood.md` — Load when: working under `plugins/dogfood/` or adding an end-to-end exercise of a CLI feature.
- Missing `pluginfinity` bin in a plugin workspace → `okf/gotchas/workspace-bin-needs-built-cli.md` — Load when: `pnpm exec pluginfinity` fails, or touching a `prepare` or `postprepare` script.
- Hook library → `okf/decisions/hook-library-is-build-injected.md` — Load when: writing or changing a hook script, the hook library or the bats helper.
- Server launchers and the server library → `okf/decisions/server-launchers-ship-by-discovery-and-files.md` — Load when: writing an MCP or LSP launcher, changing the server library, or deciding which files a build ships.
- Body tokens and `pluginfinity://` links → `okf/decisions/body-tokens-and-links-are-built-per-target.md` — Load when: writing `{{tool …}}`, `{{agent …}}`, `{{skill …}}` or `{{plugin_root}}` in a skill or agent body, a `pluginfinity://` link, or changing `tokens.ts` or a target's run-time names.
- Hook scripts change mode around every commit, and `build --check` ignores it → `okf/gotchas/build-check-stale-on-sh-after-commit.md` — Load when: `.sh` modes on disk disagree with git, or `build --check` fails on a copied file's executable bit.
- `doctor` prints JSON under Claude Code → `okf/gotchas/agent-environment-selects-json-output.md` — Load when: CLI output is JSON when you expected the human form, or a test asserts on human output.
- Source model and target descriptions → `okf/models/plugin-source-model.md`, `okf/models/target-description.md` — Load when: adding a component kind, a frontmatter field, or a capability or field map to a target.
- Monitors → `okf/decisions/monitors-are-a-component.md` — Load when: writing or changing a monitor, `monitors` config, or the monitor library.
- Logging (`error.log`, `debug.log`, `PLUGINFINITY_DEBUG`) → `okf/decisions/one-logging-standard.md` — Load when: a hook, server, monitor or script needs to log, or changing `log.sh`.
- Hook entry env (event, fail policy, run-time matcher) → `okf/decisions/entry-facts-travel-as-env.md` — Load when: changing how a hook entry is rendered, `failClosed`, or a host that ignores a matcher.
- Hooks fail open → `okf/decisions/hooks-fail-open.md` — Load when: deciding what a hook script does on an error or an unknown input.
- Build notes → `okf/decisions/build-notes-cover-hooks-and-monitors.md` — Load when: a target drops, degrades or omits a field, or you are changing what `build` reports.
- Host measurements (tool names, hook environment, server environment) → `okf/measurements/copilot-runtime-names.md`, `okf/measurements/copilot-plugin-hook-environment.md`, `okf/measurements/plugin-server-environment.md` — Load when: a claim about what a host does at run time needs evidence.
- Host plugin formats → `okf/references/claude-code-plugin-format.md`, `okf/references/claude-code-marketplace-format.md`, `okf/references/copilot-cli-plugin-format.md` — Load when: writing or changing a target's manifest, layout, hooks or path-variable handling.
- Skill and agent frontmatter per host → `okf/references/skill-frontmatter.md`, `okf/references/agent-frontmatter.md` — Load when: mapping, stripping or reshaping frontmatter for a target.
- Binary hooks prior art → `okf/references/claude-binary-plugin.md` — Load when: designing the hook model or compiled hook binaries.
- Test layout → `packages/cli/__test__/CLAUDE.md` — Load when: adding or moving a test in any package.

Effect v4 work goes through the effected plugin's agents and skills, never from memory.
