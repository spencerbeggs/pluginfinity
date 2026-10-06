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
  pluginfinity.config.ts      name, metadata, targets, hooks, servers, files
  package.json                its "version" is every manifest's version
  skills/<skill>/SKILL.md     plus references/, scripts/, assets/
  agents/<agent>.md
  hooks/                      hook scripts; the directory ships whole
  bin/                        server launchers; they ship because a server names them
  builds/<target>/            generated and committed; never edited
```

Anything else at the root, such as `__test__/` or `scripts/`, ships only if a server names it or `files`
lists it.

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
| `{{tool Read}}` | `Read` | `view` |
| `{{tool mcp__plugin_<plugin>_<server>__<tool>}}` | as written | `<server>-<tool>` |
| `{{agent <agent>}}` | `<plugin>:<agent>` | `<plugin>:<agent>` |
| `{{skill <skill>}}` | `/<plugin>:<skill>` | `/<plugin>:<skill>` |
| `{{plugin_root}}` | `${CLAUDE_PLUGIN_ROOT}` | fails the build |

- **Name tools in prose with `{{tool …}}`.** The Copilot model sees `view`, `bash`, `edit` and
  `create`, not `Read`, `Bash`, `Edit` and `Write`, and this plugin's MCP tools as `<server>-<tool>`. A
  tool name written plainly stays Claude's on Copilot. A token writes the bare name, so put the backticks
  around it yourself.
- **Name agents with `{{agent …}}`.** Copilot namespaces agent ids, so a bare `okf-docs` is no agent
  there. On the command line it is `copilot --agent <plugin>:<agent>`.
- **Link to another skill's file or to an agent** with an inline link,
  `[text](pluginfinity://skill/<skill>/<path>)` or `[text](pluginfinity://agent/<agent>)`. Claude Code
  gets a link under `${CLAUDE_PLUGIN_ROOT}`, Copilot gets prose such as "text (the `<skill>` skill's
  `<path>`)".
- **A token or link that cannot be spelled fails the build**, with its file, line and host. Put a passage
  only one host can spell in a host block: a token in another host's block is never read.
- **`\{{` keeps a token literal.** Tokens are replaced in code too. A `{{` that does not start
  `tool`, `agent`, `skill` or `plugin_root`, such as GitHub Actions' `${{ github.sha }}`, is plain text.

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
- **Never put a `cwd` on a Claude MCP server.** Claude ignores it and starts the server in the project,
  so the build fails. Set `cwd` under `copilot.mcpServers`, or `cd` in the launcher.
- **Copilot has no LSP `workspaceFolder` or `settings`.** Setting either fails the Copilot build; give
  that server a Copilot copy without them under `copilot.lspServers`.
- **`PLUGINFINITY_` env keys are reserved.** The build adds `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN`
  and `PLUGINFINITY_LIB` to every local server's `env`.
- **Biome warns `noTemplateCurlyInString`** on `"${PLUGIN_ROOT}/..."` in the config. It is a warning, and
  the string is meant literally: keep it a plain string, never a template literal. To silence it, put
  `// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder` on the line
  above, or turn the rule off for `pluginfinity.config.ts` in a Biome `overrides` entry.

Write the launcher on the server library with the `plugin-scripts` skill.

## Commands

| Command | What it does |
| :-- | :-- |
| `pluginfinity build` | Writes `builds/<target>/`, touching only files that differ |
| `pluginfinity build --check` | Writes nothing; fails when `builds/` differs from a fresh build |
| `pluginfinity validate` | Requires current builds, then runs each host's own check |
| `pluginfinity doctor` | Reports the runtime, the host CLIs and the config |

Run `build` after every source change and commit `builds/` with it. `--target <id>` limits a command to
one host. A finding exits 1 with a message and a hint; read [the findings](references/findings.md) for
what each means.

- **Read the notes under each target.** `build`, `build --check` and `validate` list, under each target's
  `✓` line, every field the host dropped or degraded, every tool it cannot name and every hook event it
  omitted, one line per file: `· agents/x.md: dropped color; tool-dropped ToolSearch`. Notes never fail a
  command, but a name you meant to keep, such as an MCP tool, shows up there first.
- **Give the plugin folder as `[path]` when it is not a workspace package.** `pnpm exec pluginfinity` run
  inside a folder with no `package.json` of its own fails with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`. Run
  from the repository root instead, such as `pluginfinity build plugin` and
  `pluginfinity build --check plugin`, or in root `package.json` scripts.
- **`pluginfinity plugin add` and `pluginfinity init` are stubs.** They check their flags and then fail
  with `NotImplemented`. Write `pluginfinity.config.ts` by hand from [the config](references/config.md),
  including when you migrate an existing plugin.

## Repository hygiene

`build --check` compares every file in `builds/` with a fresh build, byte for byte and mode for mode.
Anything that rewrites `builds/` after the build makes it fail:

- **Exclude `builds/**` from formatters that write.** Biome `--write` collapses short arrays in built JSON,
  and `markdownlint --fix` rewrites built Markdown. Add `builds/**` to Biome's ignored files and to the
  markdownlint ignores, and to any lint-staged pattern that runs them.
- **Keep source and build modes in step.** A built file keeps its source file's mode. A commit hook that
  changes modes, such as lint-staged running `chmod -x` on staged `*.sh`, flips the built copy but not the
  source, or the other way round. Give the source the mode the hook leaves (`644` for `*.sh` under a
  `chmod -x` hook, which is fine with the default `scripts.invoke: "bash"`), then rebuild.
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
- [Hooks](references/hooks.md): script and command entries, `scripts.invoke`, fallbacks and what ships.
- [What each host gets](references/targets.md): how every field, tool, model, path and server is
  translated.
- [Findings](references/findings.md): every error a command reports, its cause and its fix.
