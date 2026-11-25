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

This skill covers the source, the config and the build. Six skills beside it cover the parts:

| When you are | Read |
| :-- | :-- |
| Writing or testing a skill | `skill-authoring` |
| Writing an agent | `agent-authoring` |
| Choosing a hook event, or checking what a hook receives and may answer | `hook-events` |
| Writing a hook as a bash script, a server launcher, or a script a skill runs | `bash-hooks` |
| Writing a hook as a compiled program | `native-hooks` |
| Wording text meant to change what an agent does | `persuasion` |

## The source

```text
<plugin>/
  pluginfinity.config.ts      name, metadata, targets, hooks, env, servers, monitors, files
  package.json                its "version" is every manifest's version
  skills/<skill>/SKILL.md     plus references/, scripts/, assets/
  agents/<agent>.md
  hooks/                      hook scripts; the directory ships whole
  hooks/bin/                  prebuilt native hooks, one file per platform
  native/, build.zig          native hook sources and their Zig build; never shipped
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
| `\{{skill_dir}}`, `\{{skill_dir <skill>}}` | the skill's directory, which Claude Code expands (Claude Code skills docs) | `<skill base directory>`, a placeholder the model fills |

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

## Hooks

Hooks are declared once in the config, keyed by Claude Code's event names. Each entry has exactly one handler:

```ts
hooks: {
  SessionStart: [{ script: "hooks/session-start.sh", timeout: 5 }],
  PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/guard", timeout: 5, failClosed: true }],
  Stop: [{ prompt: "Did the tests run? $ARGUMENTS", fallback: "omit" }],
},
```

- **`script` runs a bash script** on the hook library, which adapts one script to both hosts. This is the
  default; write it with the `bash-hooks` skill.
- **`binary` runs a prebuilt native program.** It names a path prefix, and the build ships every
  `<prefix>-<os>-<arch>` file beside it. pluginfinity does not compile them: build them first, with the
  `native-hooks` skill, and rebuild them before every `pluginfinity build`.
- **`command` is a shell string as written.** Nothing adapts it to the host, and a matcher the host ignores is
  not applied for it.
- **`http`, `mcpTool`, `prompt` and `agent` run on Claude Code only.** On Copilot they fail the build unless the
  entry sets `fallback: "omit"`.
- **Never write a hooks file.** The build writes `hooks/hooks.json` for each host, and a source file there fails it.
- **A hook fails open** unless its entry sets `failClosed: true`. Set it only on a guard that must not let a call
  through when it breaks.
- **`if`, `statusMessage`, `async` and `asyncRewake` are Claude Code's.** Copilot's copy drops them with a
  `hook-field-dropped` note, so there a hook with an `if` runs on every matcher hit.
- **An event Copilot lacks fails its build** unless every entry for it sets `fallback: "omit"`.

Every field is in [hooks](references/hooks.md); which event to use and what it can answer on each host is the
`hook-events` skill.

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

- **`${PLUGIN_ROOT}` is the one placeholder,** and only in a server's `command`, `args`, `env` values and `cwd`
  or `workspaceFolder`. A host's own spelling, such as `$CLAUDE_PLUGIN_ROOT`, fails the build.
- **A path a server names after `${PLUGIN_ROOT}/` ships.** `files` ships what no server names.
- **A Copilot MCP server cannot learn the user's project.** Design it to take the project from its tool arguments.
- **Never put a `cwd` on a Claude MCP server,** and Copilot has no LSP `workspaceFolder` or `settings`: each fails
  that host's build.

Read [servers and launchers](references/servers.md) before you add or change a server: it has the full rules,
the reserved `PLUGINFINITY_` variables and the Biome warning on `${PLUGIN_ROOT}`. Write the launcher with the
`bash-hooks` skill's [scripts outside hooks](pluginfinity://skill/bash-hooks/references/scripts.md).

## Session env

A value decided once per session and read by several hooks or scripts, such as a package manager or a switch
the user sets in `.env`, goes in the config's `env`:

```ts
env: {
  prefix: "MYPLUGIN",
  vars: { MYPLUGIN_PM: { default: "", description: "Package manager setup detects; empty when it finds none" } },
  setup: "scripts/env-setup.sh",
},
```

- **The build adds a runner as the first `SessionStart` entry.** It resolves each name once per session, lowest
  first: the `default`, the `setup` script's `NAME=value` output, the project's `.env`, its `.env.local`, then
  the environment the host started with. Only declared names are read, and `.env` files are parsed, never
  sourced.
- **Every hook that sources `hook.sh` sees the values as plain variables**, with no call; a plain `command`
  entry does not. A skill script or a monitor sources
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
[monitors](references/monitors.md). A monitor script follows the [logging](references/logging.md) standard.

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
| `pluginfinity logs` | Shows the last 50 lines of `error.log` for the nearest config's plugin, else every plugin with logs; a negative `--lines` exits 64; `--debug` for `debug.log`, `--lines <n>`, `--plugin <name>` (repeatable), `--follow` to keep reading |

Run `build` after every source change and commit `builds/` with it. `--target <id>` limits a command to
one host. A finding exits 1 with a message and a hint; read [the findings](references/findings.md) for
what each means.

- **Read the notes under each target.** `build`, `build --check` and `validate` list, under each target's
  `✓` line, every field the host dropped or degraded, every tool it cannot name, every hook event or
  monitor it omitted, every hook field it dropped, every matcher it leaves to the hook library at run time or rewrites, every hook helper
  whose output it ignores and what session env cannot do there, one line per file:
  `· agents/x.md: dropped color; tool-dropped ToolSearch`. Notes never fail a command, but a name you meant to
  keep, such as an MCP tool, shows up there first. A `hook-matcher-runtime` note is honoured only for a script
  that sources the hook library or a binary built on the native one; a plain `command` entry gets none. See [the findings](references/findings.md).
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
- [Hooks](references/hooks.md): every entry field and handler, how each kind of entry runs, `failClosed`,
  run-time matchers, fallbacks and what ships. The bash library and the bats helper are in the `bash-hooks`
  skill, and the native library in `native-hooks`.
- [Servers and launchers](references/servers.md): placeholders, what ships, per-host limits and reserved
  variables.
- [Session env](references/session-env.md): declared variables, the setup script, `.env`, reading and setting a
  value from a bash or native hook, and what each host's shell sees. Testing and migrating each have a page it
  links to.
- [Logging](references/logging.md): the two log files, the debug switch, who calls what, and `pluginfinity logs`.
- [Monitors](references/monitors.md): the config, the monitor library and a test recipe.
- [What each host gets](references/targets.md): how every field, tool, model, path and server is
  translated.
- [Findings](references/findings.md): every error a command reports, its cause and its fix.
