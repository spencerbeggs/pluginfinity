---
type: Reference
title: Skill frontmatter across hosts
description: The SKILL.md layout, frontmatter fields, body substitutions and name rules defined by the Agent Skills spec, Claude Code and GitHub Copilot, side by side.
status: draft
tags:
  - portability
stale_after: 2027-01-01T00:00:00Z
sources:
  - id: agentskills-spec
    resource: https://agentskills.io/specification
    title: Agent Skills specification
    last_modified: 2026-10-02T00:00:00Z
  - id: claude-code-skills
    resource: https://code.claude.com/docs/en/skills
    title: Extend Claude with skills (Claude Code docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: claude-code-plugin-components
    resource: https://code.claude.com/docs/en/plugins/components
    title: Add components to a plugin (Claude Code docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-about-skills
    resource: https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
    title: About agent skills (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-add-skills
    resource: https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills
    title: Adding agent skills for GitHub Copilot (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-cli-add-skills
    resource: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills
    title: Adding agent skills for GitHub Copilot CLI (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-cli-command-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference
    title: GitHub Copilot CLI command reference (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
  - id: copilot-cli-plugin-reference
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
    title: GitHub Copilot CLI plugin reference (GitHub Docs)
    last_modified: 2026-10-02T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:08:02Z
  body_sha256: da90afc6be40611f463716b120b75a68357bf51f5e1e1c1a9579289069a9b8db
---

# Skill frontmatter across hosts

A skill is the one component all three definitions share: the open Agent Skills spec[^agentskills-spec], Claude Code, which says it follows that standard and extends it[^claude-code-skills], and GitHub Copilot, which names the same open standard[^copilot-about-skills]. The base fields agree; the extensions do not.

## File layout

The spec defines a skill as a directory holding at least a `SKILL.md`, with optional `scripts/` (executable code), `references/` (documentation loaded on demand) and `assets/` (templates, images, data files), plus any other files or directories[^agentskills-spec]. `SKILL.md` must contain YAML frontmatter followed by Markdown; the body has no format restrictions. The spec recommends keeping `SKILL.md` under 500 lines, keeping file references one level deep, and using paths relative to the skill root[^agentskills-spec].

```text
skill-name/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

Where each host discovers skills:

| Scope | Claude Code | Copilot |
| :- | :- | :- |
| Project | `.claude/skills/<name>/SKILL.md`, in the start directory and each parent up to the repository root; nested `.claude/skills/` load when Claude touches files there[^claude-code-skills] | `.github/skills/`, `.agents/skills/`, `.claude/skills/`, plus parent `.github/skills/`[^copilot-cli-command-reference] |
| Personal | `~/.claude/skills/<name>/SKILL.md`[^claude-code-skills] | `~/.copilot/skills/`, `~/.agents/skills/`[^copilot-cli-command-reference] |
| Plugin | `<plugin>/skills/<name>/SKILL.md`; a root `SKILL.md` loads as a single skill when there is no `skills/` directory and no `skills` manifest key; the `skills` manifest key adds directories to the default scan[^claude-code-plugin-components] | Legacy plugins: `skills/` (overridable in the manifest), falling back to a root `SKILL.md`. Agent Plugins 1.0 plugins: immediate subdirectories of `skills/` only, fixed, no root fallback[^copilot-cli-plugin-reference] |
| Other | Enterprise managed directory; `--add-dir` directories; `.claude/commands/` files[^claude-code-skills] | `COPILOT_SKILLS_DIRS`; `.github/skills/` under `--add-dir` roots; bundled; org/enterprise remote skills[^copilot-cli-command-reference] |

Copilot requires the file to be named `SKILL.md` and says skill subdirectory names should be lowercase with hyphens for spaces[^copilot-cli-add-skills]. Claude Code reserves the folder names `synced` and `anthropic-skills` outside plugins[^claude-code-skills].

## Name and description constraints

The spec's rules for `name`[^agentskills-spec]:

- 1-64 characters.
- Only lowercase alphanumerics (`a-z`, `0-9`) and hyphens.
- Must not start or end with a hyphen, and must not contain `--`.
- Must match the parent directory name.

The spec's rules for `description`: 1-1024 characters, non-empty, describing what the skill does and when to use it[^agentskills-spec]. `compatibility`, when present, is 1-500 characters[^agentskills-spec].

The hosts relax these:

- Claude Code treats every field as optional, recommends only `description`, and defaults `name` to the directory name. An omitted `description` falls back to the first non-empty line of the body. The combined `description` and `when_to_use` text is truncated at 1,536 characters in the skill listing[^claude-code-skills]. No `name` charset rule is documented.
- Copilot CLI requires `name` and `description`. Its `name` must start with a letter or number and may contain letters, numbers, hyphens, underscores, dots, colons and spaces, max 64 characters; colons allow namespaced names such as `my-plugin:search`. `description` max is 1024 characters[^copilot-cli-command-reference]. The Copilot how-to pages say `name` must be lowercase with hyphens for spaces and "typically" matches the directory name[^copilot-add-skills].

## Field table

"Not documented" means the host's docs neither list nor reject the field.

| Field | Agent Skills spec | Claude Code | Copilot | Notes |
| :- | :- | :- | :- | :- |
| `name` | Required; rules above[^agentskills-spec] | Optional; command name, defaults to directory name[^claude-code-skills] | Required[^copilot-cli-command-reference] | In a Claude Code plugin skill, `name` replaces the last segment of `/<plugin>:<name>`[^claude-code-skills] |
| `description` | Required, max 1024[^agentskills-spec] | Recommended[^claude-code-skills] | Required, max 1024[^copilot-cli-command-reference] | All three use it to decide when to load the skill |
| `license` | Optional; license name or bundled license file[^agentskills-spec] | Accepted, not acted on[^claude-code-skills] | Optional[^copilot-add-skills] | Not in the Copilot CLI field table[^copilot-cli-command-reference] |
| `compatibility` | Optional, max 500 characters[^agentskills-spec] | Accepted (string up to 500 characters), not acted on[^claude-code-skills] | Not documented | |
| `metadata` | Optional; map of string keys to string values[^agentskills-spec] | Free-form YAML map, not acted on; a non-map value is dropped[^claude-code-skills] | Not documented | `gh skill install` writes provenance metadata (source repository, ref, tree SHA) into the skill's frontmatter[^copilot-add-skills]; the key it uses is not documented |
| `allowed-tools` | Optional, experimental; space-separated string[^agentskills-spec] | Space- or comma-separated string or YAML list; grant lasts for the invoking turn[^claude-code-skills] | Comma-separated list or YAML array; `"*"` for all tools[^copilot-cli-command-reference] | Tool vocabularies differ: the spec's example is `Bash(git:*) Bash(jq:*) Read`[^agentskills-spec]; Copilot's example is `shell`[^copilot-add-skills] |
| `disallowed-tools` | Not defined | Tools removed while the skill is active; same formats as `allowed-tools`[^claude-code-skills] | Not documented | |
| `when_to_use` | Not defined | Appended to `description` in the listing, counts toward the 1,536-character cap[^claude-code-skills] | Not documented | The only Claude Code skill field that uses an underscore[^claude-code-skills] |
| `argument-hint` | Not defined | Autocomplete hint, e.g. `[issue-number]`[^claude-code-skills] | Freeform hint shown in the skill picker[^copilot-cli-command-reference] | |
| `arguments` | Not defined | Named positional arguments for `$name` substitution; space-separated string or YAML list[^claude-code-skills] | Not documented | |
| `disable-model-invocation` | Not defined | `true` stops automatic loading and preloading into subagents; default `false`[^claude-code-skills] | Prevents automatic invocation; default `false`[^copilot-cli-command-reference] | Same name and meaning on both hosts |
| `user-invocable` | Not defined | `false` hides it from the `/` menu; default `true`[^claude-code-skills] | Whether users can invoke with `/SKILL-NAME`; default `true`[^copilot-cli-command-reference] | Same name and meaning on both hosts |
| `model` | Not defined | Model for the rest of the turn, or `inherit`; with `context: fork`, the forked subagent's model[^claude-code-skills] | Not documented | |
| `effort` | Not defined | `low`, `medium`, `high`, `xhigh`, `max`[^claude-code-skills] | Not documented | |
| `context` | Not defined | `fork` runs the skill in a subagent[^claude-code-skills] | Not documented | |
| `agent` | Not defined | Subagent type for `context: fork`; defaults to `general-purpose`[^claude-code-skills] | Not documented | |
| `background` | Not defined | Only with `context: fork`; `false` waits for the result; default `true`[^claude-code-skills] | Not documented | |
| `hooks` | Not defined | Hooks registered when the skill is invoked, kept for the session[^claude-code-skills] | Not documented | |
| `paths` | Not defined | Globs that limit automatic activation; comma-separated string or YAML list[^claude-code-skills] | Not documented | Not accepted in Claude Code command files[^claude-code-skills] |
| `shell` | Not defined | `bash` (default) or `powershell`, for `` !`cmd` `` and ` ```! ` blocks[^claude-code-skills] | Not documented | |

Claude Code boolean fields accept `yes`, `no`, `on`, `off`, `1` and `0` in any case as well as `true` and `false`[^claude-code-skills].

## Body string substitutions

Claude Code substitutes these in the skill body[^claude-code-skills]:

| Token | Expands to |
| :- | :- |
| `$ARGUMENTS` | All arguments as typed. If no placeholder receives an argument, Claude Code appends `ARGUMENTS: <value>` |
| `$ARGUMENTS[N]` | Argument by 0-based index |
| `$N` | Shorthand for `$ARGUMENTS[N]` |
| `$name` | Named argument declared in `arguments` |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_EFFORT}` | Current effort level |
| `${CLAUDE_SKILL_DIR}` | Directory containing `SKILL.md`; for plugin skills, the skill's subdirectory, not the plugin root |
| `${CLAUDE_PROJECT_DIR}` | Project root |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin installation directory; plugin skills only |
| `${CLAUDE_PLUGIN_DATA}` | Plugin persistent data directory; plugin skills only |

Indexed arguments use shell-style quoting. An indexed placeholder with no argument stays unchanged; a named one with no argument becomes an empty string. `\$1` escapes an argument placeholder. `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PROJECT_DIR}` and the two plugin variables are also substituted in Bash rules inside `allowed-tools`[^claude-code-skills].

Dynamic context injection: `` !`<command>` `` at the start of a line or after whitespace, or a fenced block opened with ` ```! `, runs before the content reaches Claude and is replaced by the output. Substitution is a single pass; output is not re-scanned. A failing command aborts the whole invocation. The `disableSkillShellExecution` setting replaces each command with `[shell command execution disabled by policy]`[^claude-code-skills].

The spec defines no substitutions[^agentskills-spec]. The Copilot skill pages document none; Copilot says it makes every file in the skill directory available alongside the instructions, and its example tells the agent to run a script "from this skill's base directory"[^copilot-add-skills].

## Commands and skills

In Claude Code, custom commands have been merged into skills: `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy`. Command files accept the same frontmatter except `name` and `paths`, and cannot carry supporting files[^claude-code-skills]. Command names come from the file path, with `/` in subdirectories turned into `:`, so `.claude/commands/frontend/component.md` is `/frontend:component`[^claude-code-skills]. In a plugin, `commands/<file>.md` becomes `/<plugin>:<file>` and `commands/db/migrate.md` becomes `/<plugin>:db:migrate`; the `commands` manifest key replaces the default `commands/` scan, while the `skills` key adds to `skills/`[^claude-code-plugin-components].

Copilot CLI reads `.claude/commands/` as an "alternative skill format". Command names come from the filename, and command files support `argument-hint`, `description`, `allowed-tools` and `disable-model-invocation`. Commands have lower priority than skills of the same name[^copilot-cli-command-reference]. Agent Plugins 1.0 plugins keep Copilot slash commands in `com.github.copilot/commands/`[^copilot-cli-plugin-reference].

## Naming and deduplication of plugin skills

- Claude Code: `/<plugin>:<directory>`, or `/<plugin>:<name>` when `name` is set. A plugin skill and a non-plugin skill with the same name both load, because the plugin one is namespaced[^claude-code-skills].
- Copilot CLI: skills deduplicate by the `name` field, first found wins, and a project or personal skill silently overrides a plugin skill with the same name[^copilot-cli-plugin-reference]. When two plugins ship the same skill name, both are reachable as `/my-plugin/search` and `/other-plugin/search`, and the bare name goes to the higher-priority plugin[^copilot-cli-command-reference].

## Unknown fields

- Claude Code ignores a field it does not recognize without reporting an error, and a field name must match exactly, hyphens included. Unparseable YAML still loads the skill with no fields set[^claude-code-skills].
- claude.ai uploads, the Skills API and `package_skill.py` accept only `name`, `description`, `license`, `compatibility`, `metadata` and `allowed-tools`, and fail with a hard error on any other key[^claude-code-skills].
- Copilot: treatment of unknown skill fields is not documented. `gh skill publish --dry-run` validates skills against the Agent Skills spec[^copilot-add-skills].
- The spec documents the `skills-ref validate` tool for checking frontmatter, but does not say how clients should treat extra keys; it reserves `metadata` for properties the spec does not define[^agentskills-spec].

[^agentskills-spec]: <https://agentskills.io/specification>
[^claude-code-skills]: <https://code.claude.com/docs/en/skills>
[^claude-code-plugin-components]: <https://code.claude.com/docs/en/plugins/components>
[^copilot-about-skills]: <https://docs.github.com/en/copilot/concepts/agents/about-agent-skills>
[^copilot-add-skills]: <https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills>
[^copilot-cli-add-skills]: <https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills>
[^copilot-cli-command-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference>
[^copilot-cli-plugin-reference]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
