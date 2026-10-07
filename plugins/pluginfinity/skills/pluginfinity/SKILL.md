---
name: pluginfinity
description: >-
  How to author and build an agent plugin with pluginfinity, which turns one host-neutral source into
  Claude Code and GitHub Copilot plugins. Use when a directory holds a pluginfinity.config.ts, when
  writing or editing a skill, agent or hook in a pluginfinity plugin, when running pluginfinity build,
  build --check or validate, or when a pluginfinity command reports a finding to fix.
---

# Authoring a pluginfinity plugin

pluginfinity builds one plugin source into each host's format. You edit the source; the build writes
`builds/claude/` and `builds/copilot/`. Never edit a file under `builds/`: the next build reverts it,
and `build --check` fails until it does.

## The source

```text
<plugin>/
  pluginfinity.config.ts      name, metadata, targets, hooks, env, servers, monitors, files
  package.json                its "version" is every manifest's version
  skills/<skill>/SKILL.md     plus references/, scripts/, assets/
  agents/<agent>.md
  hooks/                      hook scripts; the directory ships whole
  bin/                        server launchers; they ship because a server names them
  monitors/                   monitor scripts; they ship because a monitor names them (Claude Code only)
  builds/<target>/            generated and committed; never edited
```

Anything else at the root, such as `__test__/` or `scripts/`, ships only if a server names it, `env.setup`
names it or `files` lists it.

## Rules that bite

- **Names.** A skill's name is its directory name and an agent's is its file stem: 1 to 64 characters of
  `a-z`, `0-9` and single hyphens. A frontmatter `name` must match.
- **Frontmatter uses Claude Code's field names** and must be valid YAML. A plain value holding `:` or
  `#` is not what it looks like; fold it with `>-` or quote it. An unknown field fails the build.
- **One host's difference goes in that component's `targets` block**, keyed by target id (`claude`,
  `copilot`): `false` leaves the component out of that host, and an object sets fields for that host
  only. A `description` there replaces the base one for that host.
- **One host's wording goes in a host block** in the body, each marker on a line of its own:

  ```markdown
  <!-- pluginfinity:only claude -->
  Your preloaded skills cover this.
  <!-- /pluginfinity:only -->
  ```

- **A built skill `description` may hold at most 1,024 characters.** Copilot folds `when_to_use` into
  it, so a long pair needs a shorter `targets.copilot.description`.

## Tokens and links

A tool, agent, skill or the plugin root is spelled differently on each host. In a skill or agent body,
write a token, and each build writes that host's spelling:

| Write | Claude Code | Copilot |
| :-- | :-- | :-- |
| `\{{tool Read}}` | `Read` | `view` |
| `\{{tool mcp__plugin_<plugin>_<server>__<tool>}}` | as written | `<server>-<tool>` |
| `\{{agent <agent>}}` | `<plugin>:<agent>` | `<plugin>:<agent>` |
| `\{{skill <skill>}}` | `/<plugin>:<skill>` | `/<plugin>:<skill>` |
| `\{{plugin_root}}` | `${CLAUDE_PLUGIN_ROOT}` | fails the build |
| `\{{skill_dir}}`, `\{{skill_dir <skill>}}` | the skill's directory, which Claude Code expands | `<skill base directory>`, a placeholder the model fills |

In an agent id or skill command `<plugin>` is the plugin's name on that host (`claude.name` or
`copilot.name`, else `name`); in an MCP tool name it is the Claude Code name on both.

- **Name tools in prose with `\{{tool …}}`.** The Copilot model sees `view`, `bash`, `edit` and
  `create`, not `Read`, `Bash`, `Edit` and `Write`, and this plugin's MCP tools as `<server>-<tool>`. A
  tool name written plainly stays Claude's on Copilot. A token writes the bare name, so put the backticks
  around it yourself.
  There is no wildcard token: prose about "all of this plugin's MCP tools" must name each tool, each as
  `\{{tool …}}`.
  A tool that one host cannot name takes a fallback instead of failing the build:
  `\{{tool TodoWrite | your task list}}` writes the text after `|` on a host with no run-time name for it.
  Only a tool token takes one; see [skills and agents](references/components.md#tokens).
- **Name agents with `\{{agent …}}`.** Copilot namespaces agent ids, so a bare `okf-docs` is no agent
  there. On the command line it is `copilot --agent <plugin>:<agent>`.
- **Name a skill's own directory with `\{{skill_dir}}`** in a command the model runs, such as
  `bash "\{{skill_dir}}/scripts/check.sh"`. Copilot expands nothing in a body, so there it writes the
  placeholder `<skill base directory>`, which the model fills from the "Base directory for this skill" line
  both hosts put above the body. `\{{skill_dir <skill>}}` names a sibling skill. In an agent body only the
  named form works, and only on Claude Code. For a file the model should read, use a link instead. See
  [skill directories](references/components.md#skill-directories).
- **Link to another skill's file or to an agent** with an inline link,
  `[text](pluginfinity://skill/<skill>/<path>)` or `[text](pluginfinity://agent/<agent>)`. Claude Code
  gets a link under `${CLAUDE_PLUGIN_ROOT}`, Copilot gets prose such as "text (the `<skill>` skill's
  `<path>`)".
- **A token or link that cannot be spelled fails the build**, with its file, line and host. Put a passage
  only one host can spell in a host block: a token in another host's block is never read.
- **`\{{` keeps a token literal.** Tokens are replaced in code too. A `{{` that does not start
  `tool`, `agent`, `skill`, `skill_dir` or `plugin_root`, such as GitHub Actions' `${{ github.sha }}`, is
  plain text.

The full rules are in [skills and agents](references/components.md#tokens-and-links).

## Servers and launchers

MCP and LSP servers are declared once in the config, in Claude Code's shape, and a server's launcher is
a plain `sh` script in the plugin:

```ts
mcpServers: { mcp: { command: "sh", args: ["${PLUGIN_ROOT}/bin/start-mcp.sh"] } },
lspServers: {
  okfit: {
    command: "sh",
    args: ["${PLUGIN_ROOT}/bin/start-lsp.sh", "--stdio"],
    extensionToLanguage: { ".md": "markdown" },
    diagnostics: true,
  },
},
files: ["share/"],
```

- **`${PLUGIN_ROOT}` is the one placeholder.** It is rewritten for each host in a local MCP server's
  `command`, `args`, `env` values and `cwd`, and in an LSP server's `command`, `args`, `env` values and
  `workspaceFolder`. Nowhere else. Never write a host's spelling there, such as
  `${CLAUDE_PLUGIN_ROOT}` or `$CLAUDE_PLUGIN_ROOT`, or a brace-less `$PLUGIN_ROOT`: the build would
  pass it through unrewritten and ship nothing, so it fails the build. Write `${PLUGIN_ROOT}`.
- **A path a server names after `${PLUGIN_ROOT}/` ships** to every host whose servers name it. The path
  ends at whitespace, a quote, a shell metacharacter, `:` or `,`, so `"${PLUGIN_ROOT}/bin:/usr/bin"` in a
  `PATH` names `bin`, and a comma list names each path. A directory ships every file under it, like a
  `files` directory. The path must exist inside the plugin, be written without `.` or `..` segments
  (a directory may end in `/`), and, when it is the whole `command`, be an executable file, not a
  directory. Prefer `command: "sh"` with the launcher in `args`.
- **`files`** ships what no server names, such as data a launcher reads: files, or directories ending in
  `/`.
- **A Copilot MCP server cannot learn the user's project.** It starts in the plugin root, its client offers no
  MCP roots and no variable names the project (Copilot CLI 1.0.92, measured 2026-10-07), so
  `server_project_dir` returns 1 there. Design such a server to take the project from its tool arguments. A
  Claude Code server gets `CLAUDE_PROJECT_DIR`, starts in the project and can ask for roots.
- **Never put a `cwd` on a Claude MCP server.** Claude ignores it and starts the server in the project,
  so the build fails. Set `cwd` under `copilot.mcpServers`, or `cd` in the launcher.
- **Copilot has no LSP `workspaceFolder` or `settings`.** Setting either fails the Copilot build; give
  that server a Copilot copy without them under `copilot.lspServers`.
- **`PLUGINFINITY_` env keys are reserved.** The build adds `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN`
  and `PLUGINFINITY_LIB` to every local server's `env`.
- **Biome warns `noTemplateCurlyInString`** on `"${PLUGIN_ROOT}/..."` in the config. It is a warning, and
  the string is meant literally: keep it a plain string, never a template literal. To silence it, put
  `// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder` on the line
  above, or turn the rule off for `pluginfinity.config.ts` in a Biome `overrides` entry. A monitor `command`
  that holds `${PLUGIN_ROOT}` needs the same ignore.

Write the launcher on the server library with the `plugin-scripts` skill.

## Session env

A value decided once per session and read by several hooks or scripts, such as a package manager or a switch
the user sets in `.env`, goes in the config's `env`:

```ts
env: {
  prefix: "MYPLUGIN",
  vars: { MYPLUGIN_PM: { default: "npm", description: "Package manager detected at session start" } },
  setup: "scripts/env-setup.sh",
},
```

- **The build adds a runner as the first `SessionStart` entry.** It resolves each name once per session, lowest
  first: the `default`, the `setup` script's `NAME=value` output, the project's `.env`, its `.env.local`, then
  the environment the host started with. Only declared names are read, and `.env` files are parsed, never
  sourced.
- **Every hook sees the values as plain variables**, with no call. A skill script or a monitor sources
  `lib/pluginfinity/env.sh` with one line.
- **A hook changes a value with `hook_env_set NAME value`**, only in `SessionStart` (and Claude Code's `Setup`,
  `CwdChanged` and `FileChanged`).
- **The model's own shell sees the values on Claude Code only.** On Copilot, have the model run a script that
  sources `env.sh`; the build notes this as `env-shell-unsupported`.
- **Keep every other `SessionStart` timeout at 5 seconds or more.** A `SessionStart` hook may wait up to 3 seconds
  for the runner, and a shorter timeout gets an `env-wait-timeout` note.

The whole contract, the dogfood example, the bats helpers and the migration from a hand-written
`CLAUDE_ENV_FILE` pattern are in [session env](references/session-env.md).

## Monitors

A monitor is a background script whose stdout lines reach the model as notifications. Declare it once under
`monitors` in the config; Claude Code builds it and Copilot drops it with a `monitor-omitted` note. Write
the script on the monitor library, with `monitor_every` and `monitor_notify`, as in
[monitors](references/monitors.md). A monitor script follows the logging standard in the `plugin-scripts`
skill.

## Per-host files and skills

`files` on a target ships a path to that host only: `copilot: { files: ["copilot-only/"] }`. A skill or agent
for one host takes `targets: { <other host>: false }` in its frontmatter; see the recipe in
[skills and agents](references/components.md#recipe-a-skill-for-one-host).

## Commands

| Command | What it does |
| :-- | :-- |
| `pluginfinity build` | Writes `builds/<target>/`, touching only files that differ |
| `pluginfinity build --check` | Writes nothing; fails when `builds/` differs from a fresh build |
| `pluginfinity validate` | Requires current builds, then runs each host's own check |
| `pluginfinity doctor` | Reports the runtime, the host CLIs and the config |
| `pluginfinity logs` | Shows the last 50 lines of the plugin's `error.log`; `--debug` for `debug.log`, `--lines <n>`, `--plugin <name>` (repeatable), `--follow` to keep reading |

Run `build` after every source change and commit `builds/` with it. `--target <id>` limits a command to
one host. A finding exits 1 with a message and a hint; read [the findings](references/findings.md) for
what each means.

- **Read the notes under each target.** `build`, `build --check` and `validate` list, under each target's
  `✓` line, every field the host dropped or degraded, every tool it cannot name, every hook event or
  monitor it omitted, every matcher it leaves to the hook library at run time or rewrites, every hook helper
  whose output it ignores and what session env cannot do there, one line per file:
  `· agents/x.md: dropped color; tool-dropped ToolSearch`. Notes never fail a command, but a name you meant to
  keep, such as an MCP tool, shows up there first. A `hook-matcher-runtime` note is honoured only for a script
  that sources the hook library; a plain `command` entry gets none. See [the findings](references/findings.md).
- **A Copilot `SessionStart` matcher that holds `startup` also matches `new`.** Copilot reports a fresh session
  as `new`, so the build widens `startup` to `startup|new` and notes `hook-matcher-widened`. A regex matcher it
  cannot widen is noted `hook-matcher-regex`: add `new` to it yourself.
- **Give the plugin folder as `[path]` when it is not a workspace package.** `pnpm exec pluginfinity` run
  inside a folder with no `package.json` of its own fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`. Run
  from the repository root instead, such as `pluginfinity build plugin` and
  `pluginfinity build --check plugin`, or in root `package.json` scripts.
- **`pluginfinity plugin add` and `pluginfinity init` are stubs.** They check their flags and then fail
  with `NotImplemented`. Write `pluginfinity.config.ts` by hand from [the config](references/config.md),
  including when you migrate an existing plugin.

## Repository hygiene

`build --check` compares every file in `builds/` with a fresh build: its content byte for byte, and for a
file copied from the source, its executable bit. Other permission bits are never compared, so a umask or
a hook that runs `chmod +x` on every script does not fail it. Anything that rewrites `builds/` after the
build does:

- **Exclude `builds/**` from formatters that write.** Biome `--write` collapses short arrays in built JSON,
  and `markdownlint --fix` rewrites built Markdown. Add `builds/**` to Biome's ignored files and to the
  markdownlint ignores, and to any lint-staged pattern that runs them.
- **A mode flip is fixed by a rebuild, not by the source mode.** A copied file keeps its source file's
  mode, and `build --check` compares that bit, so a hook that sets or clears it on the source (lint-staged
  `chmod -x` on `*.sh`, or husky `chmod +x` after a commit, merge or checkout) leaves the committed build
  stale until you run `pluginfinity build`. Source scripts need no particular mode, and `644` is fine with
  the default `scripts.invoke: "bash"`.
- **Rebuild after `changeset version`.** Every manifest copies `version` from the plugin's `package.json`,
  so after a version bump run `pluginfinity build` and commit `builds/`, for example in the script that
  runs `changeset version`. When you migrate, retarget any changesets `versionFiles` entry that wrote
  into a hand-written `plugin.json`: either drop it and rebuild, or point it at
  `builds/claude/.claude-plugin/plugin.json` and `builds/copilot/plugin.json`, which then match what the
  next build writes.

## Go deeper

- [The config](references/config.md): every field, hooks and server overrides, and the target keys.
- [Skills and agents](references/components.md): frontmatter, `targets` blocks, host blocks, tokens and
  links, and support files.
- [Hooks](references/hooks.md): script and command entries, `scripts.invoke`, `failClosed`, run-time
  matchers, fallbacks and what ships.
- [Session env](references/session-env.md): declared variables, the setup script, `.env`, `hook_env_set`,
  what each host's shell sees, testing and migrating.
- [Monitors](references/monitors.md): the config, the monitor library and a test recipe.
- [What each host gets](references/targets.md): how every field, tool, model, path and server is
  translated.
- [Findings](references/findings.md): every error a command reports, its cause and its fix.
