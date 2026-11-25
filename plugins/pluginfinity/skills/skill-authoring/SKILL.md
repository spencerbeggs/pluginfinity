---
name: skill-authoring
description: >-
  Use when writing, reviewing or testing a skill in a pluginfinity plugin: a SKILL.md, its references/,
  scripts/ or assets/. Covers the name and description rules, how a skill is triggered, what belongs in the
  body and what in a reference, what GitHub Copilot does with each frontmatter field, and how to prove a
  skill with trigger and output evals, even when the request is only to "tidy up" or "improve" a skill.
paths:
  - "**/skills/*/SKILL.md"
---

# Writing a skill

A skill is a directory, `skills/<name>/`, holding `SKILL.md` and any support files. You write it once, in Claude Code's field names, and the build writes each host's copy.

At start-up an agent sees only each skill's `name` and `description`. The body loads when the skill is chosen, and a reference loads only when the body says to read it. Most skills that fail do so at the first step: the description does not say when to use the skill, so it never loads.

Two references hold the detail. Read one when you reach that work:

- Read [what makes a skill worth loading](references/writing.md) before you write or restructure a body: grounding it in real work, what to leave out, how prescriptive to be, and how to design a script an agent can drive.
- Read [proving a skill](references/evals.md) before you claim a skill works or change a description to fix triggering: trigger evals, output evals against a baseline, and how to read the results.

## The checklist

1. **The name is the directory name:** 1 to 64 characters of `a-z`, `0-9` and single hyphens, with no hyphen at either end. A frontmatter `name` must match it.
2. **The description says when to use the skill.** "Use when…", about what the user wants, not how the skill works. See below.
3. **The built description is at most 1,024 characters.** Copilot's copy also holds `when_to_use` and `paths`, so it is longer than what you wrote.
4. **The invocation fields are chosen, not left by accident.** See below.
5. **The body holds what every use needs, and stays under 500 lines.** Detail goes in `references/`.
6. **Every reference is named in the body with the condition for reading it.** "Read `references/api-errors.md` if the API returns a non-200", not "see `references/`".
7. **References are one level deep.** A reference that sends the agent to another reference is a chain it will not follow reliably.
8. **Gotchas are in the body.** An agent that does not know a problem exists will not go looking for the reference that explains it.
9. **Tools, agents, skills and paths are written as tokens and links**, so each host's copy names what that host has.
10. **Build it, read the notes, and run it** on a real task before calling it done.

## The description

The description is the whole triggering mechanism.

- **Say when, in the imperative.** "Use when adding or changing a hook…", not "This skill explains hooks".
- **Describe the user's intent, not the implementation.** The agent matches what was asked for.
- **Do not summarize the workflow.** An agent that reads "reads the diff, writes a message, runs the tests" in a description follows that and skips the body.
- **Name the cases where the user will not say the keyword:** "even if they don't mention CSV". A description that is too modest never fires; one that is too broad fires on near-misses. An eval tells you which you have.
- **Lead with the strongest trigger.** Long descriptions are cut short in the listing.
- **Fold it with `>-`.** A plain YAML value that holds `:` or `#` is not what it looks like, and the build rejects it.

Poor: `Helps with PDFs.` Good: `Extracts text and tables from PDF files, fills PDF forms and merges PDFs. Use when working with PDF documents or when the user mentions PDFs, forms or document extraction.`

A skill is consulted for work the agent cannot do alone. A one-step task may not trigger a well-described skill, and that is not a description bug.

## How a skill is triggered

| You set | Claude Code | Copilot |
| :-- | :-- | :-- |
| Nothing | The model loads it by description; the user can run `/<plugin>:<skill>` | The same |
| `when_to_use` | Read with the description | Folded into the description as "Also use when: …" |
| `paths` | Limits automatic loading to work on matching files | Folded into the description as "Applies to files matching: …" |
| `user-invocable: false` | No slash command; for background knowledge | Kept |
| `disable-model-invocation: true` | Only the user can run it; for an action with side effects, such as a deploy | Kept |

- **`paths` does not load a skill when a matching file is opened.** On Claude Code it only narrows when the model may load the skill by itself, and on Copilot it is a sentence in the description. A skill that must be read before a kind of work needs a description that says so, and an agent that depends on it should be told to read it.
- **Keep a `paths` glob as narrow as the files really are.** `**/*.md` matches nearly everything.
- **Do not set `paths` on a skill about a kind of task.** With no matching file open it will not load.
- **`allowed-tools`, when set, lists only what the body calls**, scoped as `Bash(git *)` and not a bare `Bash`. Copilot has no per-command rules, so a scoped rule fails its build; set the field under `targets.copilot`.

## What each host gets

Claude Code keeps every field. Copilot keeps `name`, `description`, `license`, `argument-hint`, `disable-model-invocation` and `user-invocable`, folds `when_to_use` and `paths` into the description, translates `allowed-tools`, and drops `disallowed-tools`, `arguments`, `model`, `effort`, `context`, `agent`, `background`, `hooks` and `shell` with a build note. `compatibility` and `metadata` fail the Copilot build. An unknown field fails every build.

- **A long `description` plus `when_to_use` can pass on Claude Code and fail on Copilot.** Give Copilot a shorter one under `targets.copilot.description`.
- **A skill for one host** takes `targets: { copilot: false }`, or `claude: false`.
- **A passage for one host** goes in a host block: `<!-- pluginfinity:only claude -->` … `<!-- /pluginfinity:only -->`, each marker on its own line.

## In the body

- **Name a tool with `\{{tool Read}}`**, an agent with `\{{agent <name>}}` and a skill with `\{{skill <name>}}`. A plain `Read` stays `Read` on Copilot, where the tool is `view`.
- **Run one of the skill's own scripts as `bash "\{{skill_dir}}/scripts/<script>"`.** On Copilot the token becomes a placeholder the model fills from the base-directory line above the body.
- **Link to a file the agent should read:** a relative link inside the skill, `pluginfinity://skill/<skill>/<path>` for another skill's file.
- **`\{{` keeps a token literal** when the text is about tokens, as this page is.
- Support files are copied to every host. A `.md` file gets the same token and host-block pass as the body; any other file is copied byte for byte.

The full rules are in the `pluginfinity` skill's [skills and agents](../pluginfinity/references/components.md) reference.

## Check it

```sh
pluginfinity build && pluginfinity build --check
wc -l skills/<name>/SKILL.md
```

- The build checks the name, the YAML, unknown fields, the description limit and every token and link. A failure names the file, the line and the host.
- Read the notes under each target for a dropped or degraded field.
- Then use the skill on a real task and read what the agent did, not only its answer. An agent that wastes turns usually has instructions that are vague, that do not apply, or that offer choices with no default.

To check that a description triggers, run the trigger harness, which makes real model calls:

```sh
bash "{{skill_dir}}/scripts/trigger-harness.sh" --help
```

Read [proving a skill](references/evals.md) first: it says how to build the query files and how to read the rates.

## Common mistakes

- A description that recaps the body.
- A reference nobody is told when to read.
- A gotcha filed in a reference.
- A reference's table copied into the body "for convenience"; the two drift apart.
- A body that explains what the agent already knows, such as what a PDF is.
- `paths` relied on to load a skill when a file is opened.
- `argument-hint` on a skill with `user-invocable: false`.
- Capitals and "MUST" throughout. The `persuasion` skill covers how much force a rule needs.
