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
  pluginfinity.config.ts      name, metadata, targets, hooks
  package.json                its "version" is every manifest's version
  skills/<skill>/SKILL.md     plus references/, scripts/, assets/
  agents/<agent>.md
  hooks/                      hook scripts; the directory ships whole
  builds/<target>/            generated and committed; never edited
```

Anything else at the root, such as `__test__/` or `scripts/`, is never shipped.

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

## Go deeper

- [The config](references/config.md): every field, hooks overrides and the target keys.
- [Skills and agents](references/components.md): frontmatter, `targets` blocks, host blocks and support
  files.
- [Hooks](references/hooks.md): script and command entries, `scripts.invoke`, fallbacks and what ships.
- [What each host gets](references/targets.md): how every field, tool, model and path is translated.
- [Findings](references/findings.md): every error a command reports, its cause and its fix.
