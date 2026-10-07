# Skills and agents

## Skills

A skill is a directory, `skills/<name>/`, holding `SKILL.md` and any support files. Its name is the
directory name. `SKILL.md` opens with YAML frontmatter in Claude Code's field names:

```markdown
---
name: my-skill
description: What the skill does and when to use it.
when_to_use: the situations that should trigger it
---

# My skill
```

`description` is required. `name`, when set, must equal the directory name; every build writes it
either way. Support files are copied to every host: a `.md` file gets the same host-block pass as the
body, and any other file is copied byte for byte. Files keep their source mode. `build --check` compares
content, and a copied file's executable bit, so only a commit hook that sets or clears the executable bit
on one side fails the check; see the `pluginfinity` skill's "Repository hygiene".

## Agents

An agent is one file, `agents/<name>.md`. Its `name` is required and must equal the file stem; its
`description` is required too. Write the body as the agent's system prompt.

## Frontmatter rules

- **Claude Code's field names are the source vocabulary.** Each host's build renames, translates or drops
  them; [what each host gets](targets.md) lists every field. Every field a host drops or degrades, and
  every tool it cannot name, is listed as a note under that host's line in the build output.
- **An unknown field fails the build**, so a misspelling never ships silently.
- **It must be valid YAML.** Two plain-value traps that Claude Code's own reader forgives and every YAML
  parser does not:
  - a `:` inside the value, as in `when_to_use: flaky tests, Tests: 0/0 passed`, is a nested mapping
    and fails to parse;
  - a `#` inside the value, as in `when_to_use: parsing refs (Closes #12)`, starts a comment, and the
    rest of the line is lost.

  pluginfinity refuses both. Fold the value or quote it:

  ```yaml
  when_to_use: >-
    parsing refs (Closes #12) out of a commit message
  ```

- **Line endings are LF in every build**, whatever the source uses.
- **Unchanged frontmatter is kept as written.** When a host takes every field as is, the build writes the
  author's text unchanged, comments and folding included; otherwise it re-serializes the fields in the
  author's order.

## The `targets` block

Any skill or agent can carry a `targets` block keyed by target id. It is never written to a build. Core
fields set there are checked like the base ones, and a problem is reported as `targets.<id>.<field>`.

```yaml
targets:
  copilot:
    description: >-
      A shorter description for Copilot's 1,024-character limit.
  claude: false
```

- `false` leaves the component out of that host's build.
- An object sets fields for that host only. A core field there replaces the base value before the host's
  field map runs; a field only that host has, such as Copilot's `handoffs` on an agent, is written as is.
- A `description` set there replaces the base one, and nothing is folded into it: you wrote that host's
  description.
- An unknown target id, or a field neither core nor that host knows, fails.

### Recipe: a skill for one host

A skill that only makes sense on one host, such as one about Claude Code's monitors, is left out of the
other host's build with `false` in its own frontmatter. The skill's directory, name and files stay the same.

```yaml
---
name: watch-the-build
description: Start a background monitor that reports build results.
targets:
  copilot: false
---
```

- **Name the host that has the skill, not the one that lacks it.** `copilot: false` keeps the skill on
  Claude Code only; `claude: false` keeps it on Copilot only. Setting both leaves it nowhere.
- **A skill cannot be linked to or named on the host that lacks it.** A `pluginfinity://skill/<name>` link
  or `\{{skill <name>}}` token to it fails that host's build, with the file, line and host. Put each
  mention in a host block for the hosts that have the skill.

  ```markdown
  <!-- pluginfinity:only claude -->
  To start one, use [watch-the-build](pluginfinity://skill/watch-the-build).
  <!-- /pluginfinity:only -->
  ```

- **A skill that exists on both hosts but differs** takes a `targets.<id>.description` for each host, and a
  host block for the passages that differ, instead of two skills.

## Host blocks

A passage for one host only goes in a host block. Each marker is an HTML comment on a line of its own:

```markdown
<!-- pluginfinity:only claude -->
All fifteen skills are preloaded.
<!-- /pluginfinity:only -->
<!-- pluginfinity:only copilot -->
Use the fifteen skills in this plugin.
<!-- /pluginfinity:only -->
```

Leading whitespace before a marker is allowed, and the whole line is removed. Inside a Markdown list item,
indent the markers to the item's content column (three spaces under `1.`, two under `-`): a marker at column
0 ends the list, so `markdownlint --fix` (which lint-staged runs) renumbers the items after it and dedents their
sub-bullets without a word. Wrapping a whole item in a block instead repeats the number and trips MD029
(ordered list item prefix). To vary one item's text, put a block of indented lines inside the item.

```markdown
1. Install the plugin.
2. Reload it.
   <!-- pluginfinity:only claude -->
   Run `/reload-plugins`.
   <!-- /pluginfinity:only -->
   <!-- pluginfinity:only copilot -->
   Restart the session.
   <!-- /pluginfinity:only -->
3. Check that it loaded.
```

The opening marker lists one or more target ids. A host the block lists keeps the passage; the others
drop it; every marker line is removed from every build. Blocks do not nest. A block that never closes, a
close with no open, an unknown id or a marker sharing its line with other text fails. A marker inside
fenced code or an inline code span is plain text, so a body can show one, as this page does.

## Tokens and links

`SKILL.md`, every other `.md` file in a skill directory and an agent's body go through tokens and links
after host blocks. Frontmatter, scripts and other files do not.

### Tokens

A token is `{{`, a kind, its argument and `}}` on one line, with any whitespace inside the braces:

| Token | Claude Code | Copilot |
| :-- | :-- | :-- |
| `\{{tool <Tool>}}` | the name as written | the run-time name in [what each host gets](targets.md#run-time-names); an unlisted name fails, because Copilot has no run-time name for it |
| `\{{tool mcp__plugin_<plugin>_<server>__<tool>}}` | as written | `<server>-<tool>`, when the Copilot build declares `<server>` |
| `\{{tool mcp__<other>__<tool>}}`, another plugin's | as written | fails |
| `\{{agent <agent>}}` | `<plugin>:<agent>` | `<plugin>:<agent>` |
| `\{{skill <skill>}}` | `/<plugin>:<skill>` | `/<plugin>:<skill>` |
| `\{{plugin_root}}` | `${CLAUDE_PLUGIN_ROOT}` | fails: Copilot expands no root in a body |
| `\{{skill_dir}}` | `${CLAUDE_SKILL_DIR}` | `<skill base directory>`; see [skill directories](#skill-directories) |
| `\{{skill_dir <skill>}}` | `${CLAUDE_PLUGIN_ROOT}/skills/<skill>` | `<skill base directory>/../<skill>` in a skill; fails in an agent |

In an agent id or a skill command, `<plugin>` is the plugin's name on that host: the `claude.name` or
`copilot.name` override, else `name`. In an MCP tool name it is always the Claude Code name, the
`claude.name` override, else `name`, on both hosts. A token writes the
bare string; add backticks yourself, as in `` `\{{tool Read}}` ``.

A tool token may carry a fallback after `|`: `\{{tool TodoWrite | your task list}}` writes `TodoWrite` on Claude
Code and `your task list` on Copilot, which has no run-time name for it, instead of failing the build. The
fallback is literal prose, trimmed, not empty and without `{` or `}`; on a host that has the name it is
discarded. Only a `tool` token takes one: a `|` on `agent`, `skill`, `skill_dir` or `plugin_root` fails the
build.

A tool name may be wrapped in exactly one pair of backticks to render as a code span:
``\{{tool `Read`}}`` writes `` `Read` `` on Claude Code and `` `view` `` on Copilot, and
``\{{tool `TodoWrite` | your task list}}`` writes `` `TodoWrite` `` on Claude Code and the plain fallback,
without backticks, on a host that has no name for it. Only a `tool` token takes backticks; any other kind fails
the build.

There is no wildcard token: prose about "all of this plugin's MCP tools" must name the tools, each as `\{{tool …}}`.

- **Tokens are replaced everywhere,** fenced and inline code included.
- **`\{{` before a token keeps it literal** and drops the backslash, which is how this page shows them.
  Before any other `{{` the backslash stays.
- **Only the five kinds are tokens:** `tool`, `agent`, `skill`, `skill_dir` and `plugin_root`. A `{{` whose
  first word is something else, such as GitHub Actions' `${{ github.sha }}`, Jinja or Handlebars, is plain
  text.
- **These fail the build:** a missing or extra argument, an agent or skill this plugin does not build
  for that host, a tool that host cannot name, `plugin_root` on Copilot, a bare `skill_dir` in an agent, a
  named `skill_dir` in a Copilot agent, a token never closed on its line, and a brace inside one.

### Skill directories

`\{{skill_dir}}` is the directory of the skill whose body it is in; it works in `SKILL.md` and in the skill's
other `.md` files. `\{{skill_dir <skill>}}` is another skill's directory, and naming the own skill is the same
as the bare form. Use it where the model needs a path to put in a command:

```markdown
Run `bash "\{{skill_dir}}/scripts/check.sh" --strict` and report what it prints.
```

| Host | The build writes | At run time |
| :-- | :-- | :-- |
| Claude Code | `${CLAUDE_SKILL_DIR}`, or `${CLAUDE_PLUGIN_ROOT}/skills/<skill>` | Claude Code expands it to a path when it loads the skill |
| Copilot | `<skill base directory>`, or `<skill base directory>/../<skill>` | Copilot expands nothing in a body, so the text stays a placeholder. Both hosts put `Base directory for this skill: <absolute path>` above the body when the skill is invoked, and the model reads the path from it (Claude Code 2.1.292 and Copilot CLI 1.0.92, measured 2026-10-07) |

- **On Copilot it is not a path.** It is an instruction to the model to substitute one, so write it where the
  model reads it as a path, such as in a command, never where a script or another tool reads the text.
- **Keep commands that use it in `SKILL.md`.** Claude Code expands it in the skill body it loads. A skill
  script run through the Bash tool has no `CLAUDE_SKILL_DIR` (Claude Code 2.1.291, measured downstream), and
  whether Claude Code expands it in a reference file the model opens later is not measured.
- **An agent has no skill directory.** The bare form fails the build on every host. The named form works on
  Claude Code only, written under `${CLAUDE_PLUGIN_ROOT}`, and fails on Copilot, so put it in a `claude` host block
  or have the agent invoke the skill.
- **The named skill must exist in that host's build.** A skill the host leaves out with `targets` fails the
  build there.
- **It takes no `|` fallback and no backticks.** Put the backticks around it yourself.

`\{{skill_dir}}` and a link do different jobs. A link, `[text](references/x.md)` within the skill or
`[text](pluginfinity://skill/<skill>/<path>)` across skills, points the model at a file to read; Copilot gets it as
prose naming the skill's file. `\{{skill_dir}}` gives the model a path to type into a command it runs.

### Links

Link to another skill, a file in one, or an agent with an inline markdown link:

| Link | Claude Code | Copilot |
| :-- | :-- | :-- |
| `[text](pluginfinity://skill/<skill>)` | `[text](${CLAUDE_PLUGIN_ROOT}/skills/<skill>/SKILL.md)` | ``text (the `<skill>` skill)`` |
| `[text](pluginfinity://skill/<skill>/<path>#anchor)` | `[text](${CLAUDE_PLUGIN_ROOT}/skills/<skill>/<path>#anchor)` | ``text (the `<skill>` skill's `<path>`)`` |
| `[text](pluginfinity://agent/<agent>)` | ``text (`<plugin>:<agent>`)`` | ``text (`<plugin>:<agent>`)`` |

- **The skill and the file must exist** in the build for that host. A skill link may carry an `#anchor`,
  which Copilot's prose drops; an agent link takes no path or anchor.
- **A link inside fenced or inline code is text,** so a page can show one.
- **Only inline links are built.** Any other `pluginfinity://` outside code fails the build: a reference
  definition, an autolink, a link with a title, an image, a bare URL, in any case.
- **A link within the same skill** can stay relative, such as `references/guide.md`; skills sit at the
  same place in every build.

### When a host cannot spell one

Put the passage in a host block. Host blocks are applied first, so a token in another host's block is
never read:

```markdown
<!-- pluginfinity:only claude -->
Scripts live under `\{{plugin_root}}/scripts/`.
<!-- /pluginfinity:only -->
```

### Known limits

- An indented (four-space) code block is not treated as code, so a link there is built.
- An inline code span across two lines is not recognised.
- An escaped `\[text](pluginfinity://…)` is still built, and keeps its backslash.

## Description length

A built skill `description` may hold at most 1,024 characters, the Agent Skills limit Copilot enforces.
Copilot folds `when_to_use` and `paths` into the description, so check the folded length; when it runs
over, give Copilot its own shorter `targets.copilot.description`.
