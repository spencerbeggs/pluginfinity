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
body, and any other file is copied byte for byte. Files keep their source mode, and `build --check`
compares modes as well as bytes, so a commit hook that changes a mode on one side fails the check; see
the `pluginfinity` skill's "Repository hygiene".

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

## References

`pluginfinity://` links are not built yet. A build refuses one outside code; link with a relative path,
such as `references/guide.md` or `../other-skill/SKILL.md`, which works on every host because skills sit
at the same place in each build.

## Description length

A built skill `description` may hold at most 1,024 characters, the Agent Skills limit Copilot enforces.
Copilot folds `when_to_use` and `paths` into the description, so check the folded length; when it runs
over, give Copilot its own shorter `targets.copilot.description`.
