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
- `build --check` reports BuildStale on `.sh` files right after a commit → `okf/gotchas/build-check-stale-on-sh-after-commit.md` — Load when: `build --check` fails on hook scripts with a clean git diff.
- `doctor` prints JSON under Claude Code → `okf/gotchas/agent-environment-selects-json-output.md` — Load when: CLI output is JSON when you expected the human form, or a test asserts on human output.
- Host plugin formats → `okf/references/claude-code-plugin-format.md`, `okf/references/claude-code-marketplace-format.md`, `okf/references/copilot-cli-plugin-format.md` — Load when: writing or changing a target's manifest, layout, hooks or path-variable handling.
- Skill and agent frontmatter per host → `okf/references/skill-frontmatter.md`, `okf/references/agent-frontmatter.md` — Load when: mapping, stripping or reshaping frontmatter for a target.
- Binary hooks prior art → `okf/references/claude-binary-plugin.md` — Load when: designing the hook model or compiled hook binaries.
- Test layout → `packages/cli/__test__/CLAUDE.md` — Load when: adding or moving a test in any package.

Effect v4 work goes through the effected plugin's agents and skills, never from memory.
