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
| `{{tool <Tool>}}` | the name as written | the run-time name in [what each host gets](targets.md#run-time-names); an unlisted name fails, because Copilot has no run-time name for it |
| `{{tool mcp__plugin_<plugin>_<server>__<tool>}}` | as written | `<server>-<tool>`, when the Copilot build declares `<server>` |
| `{{tool mcp__<other>__<tool>}}`, another plugin's | as written | fails |
| `{{agent <agent>}}` | `<plugin>:<agent>` | `<plugin>:<agent>` |
| `{{skill <skill>}}` | `/<plugin>:<skill>` | `/<plugin>:<skill>` |
| `{{plugin_root}}` | `${CLAUDE_PLUGIN_ROOT}` | fails: Copilot expands no root in a body |

In an agent id or a skill command, `<plugin>` is the plugin's name on that host: the `claude.name` or
`copilot.name` override, else `name`. In an MCP tool name it is always the Claude Code name, the
`claude.name` override, else `name`, on both hosts. A token writes the
bare string; add backticks yourself, as in `` `{{tool Read}}` ``.

- **Tokens are replaced everywhere,** fenced and inline code included.
- **`\{{` before a token keeps it literal** and drops the backslash, which is how this page shows them.
  Before any other `{{` the backslash stays.
- **Only the four kinds are tokens.** A `{{` whose first word is something else, such as GitHub Actions'
  `${{ github.sha }}`, Jinja or Handlebars, is plain text.
- **These fail the build:** a missing or extra argument, an agent or skill this plugin does not build
  for that host, a tool that host cannot name, `plugin_root` on Copilot, a token never closed on its
  line, and a brace inside one.

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
Scripts live under `{{plugin_root}}/scripts/`.
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
