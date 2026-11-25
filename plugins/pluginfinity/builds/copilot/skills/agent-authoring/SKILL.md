---
name: agent-authoring
description: "Use when writing or reviewing an agent in a pluginfinity plugin, the file agents/<name>.md. Covers the description, the tools list, the skills preload, the system prompt and its boundaries section, the fields a plugin agent cannot use, and what GitHub Copilot keeps, translates or drops when the build writes its copy. Applies to files matching: **/agents/*.md"
---

# Writing an agent

An agent is one file, `agents/<name>.md`: YAML frontmatter in Claude Code's field names, then the system prompt. You write it once. The build writes `builds/claude/agents/<name>.md` and `builds/copilot/com.github.copilot/agents/<name>.agent.md`, translating the frontmatter for each host. Never write a `.agent.md` by hand.

The two mistakes that cost the most: a description that narrates what the agent does instead of saying when to delegate to it, and a system prompt that assumes the agent knows what the main conversation was about.

## The checklist

1. **`name` equals the file stem, and `description` is present.** The build fails otherwise.
2. **The description says when to delegate.** "Use when…", third person, the class of task and not one user phrase. No workflow summary: the delegating model reads only the description, and a summary there gets treated as the whole job.
3. **`tools` lists what the system prompt calls, and nothing else.** With no `tools`, a Claude Code agent inherits every tool, which makes a shipped agent impossible to review.
4. **The system prompt starts cold.** A subagent gets its own system prompt and the task it was handed, not the conversation. Say what the agent is for, how it works and how it reports.
5. **The body ends with "What this agent does not do".** Even one line. Without it an agent drifts into work the main conversation or another agent owns.
6. **Build it and read the notes** under each target. Every field or tool a host dropped is listed there.

## Frontmatter

```yaml
---
name: release-checker
description: >-
  Use when a release branch needs its changelog, version and build checked before a tag is cut.
tools:
  - Read
  - Grep
  - Glob
  - Bash
skills:
  - release-rules
model: inherit
---
```

- **Write tools by Claude Code's names** (`Read`, `Edit`, `Bash`, `Grep`). Name one of this plugin's own MCP tools `mcp__plugin_<plugin>_<server>__<tool>`. The build translates each for Copilot.
- **A skill name in `tools` grants nothing.** It is a common slip, and no host reports it. A skill goes in `skills`; the `Skill` tool is what lets a Claude Code agent load others.
- **`skills` preloads the whole skill at every start.** List only what the agent needs on its first turn. Knowledge it needs sometimes belongs in a skill it reads when the task calls for it.
- **Choose `model` on purpose.** `inherit` runs the agent on the session's model and is the only alias both hosts accept. `haiku`, `sonnet` and `opus` work on Claude Code and fail the Copilot build; see below.
- **`isolation: worktree`** suits an agent that makes exploratory or destructive changes. **`memory`** needs instructions in the body to read it before and update it after, or the directory sits unused. Both are Claude Code only.
- **`paths` and `disable-model-invocation` are skill fields.** An unknown field fails the build.
- **It must be valid YAML.** Fold a description that holds `:` or `#` with `>-`.

### Fields a plugin agent cannot use

Claude Code ignores `hooks`, `mcpServers`, `permissionMode` and `initialPrompt` on an agent that ships in a plugin. The build drops them and lists each as a `dropped` note, so nothing ships that looks live and is not. If the agent needs one:

- **A hook** goes in the plugin's `hooks` in `pluginfinity.config.ts`. On Claude Code a script can tell which agent it is running under from `agent_type` in the event's input.
- **An MCP server** goes in the plugin's `mcpServers`, and the agent names its tools in `tools`.
- **A permission mode** cannot ship in a plugin. Design the agent to work without it.

## The system prompt

- **Open with what the agent is and what one run of it produces.**
- **Give the working order as steps** when order matters, and the rules as a short list with their reasons.
- **Name tools, agents and skills with tokens:** `{{tool Read}}`, `{{agent <name>}}`, `{{skill <name>}}`. Each host's build writes its own spelling; a plain `Read` stays `Read` on Copilot, where the model has no tool of that name.
- **Say how to report:** what the last message must contain, since that message is all the caller sees.
- **End with the boundaries section.**

```markdown
## What this agent does not do

- It does not cut the tag or push. It reports, and the caller decides.
- It does not fix what it finds.
```

For how forceful the wording should be, read the `persuasion` skill. A system prompt is followed closely, so plain instructions with reasons work better than capitals.

## What Copilot gets

| You write | Copilot's copy | What to do |
| :-- | :-- | :-- |
| `name`, `description` | Kept | Nothing |
| `tools` | Translated: `Read` to `read`, `Edit` and `Write` to `edit`, `Bash` to `execute`, `Grep`, `Glob`, `WebFetch` and `WebSearch` by name, this plugin's MCP tools to `<server>/<tool>` | Read the notes for a `tool-dropped` |
| A tool Copilot has no name for, such as `Skill`, `TodoWrite`, `SendMessage` or another plugin's MCP tool | Dropped, with a `tool-dropped` note | Check the agent still works without it |
| A rule such as `Bash(git log:*)` | Fails the Copilot build: Copilot has no per-command rules, and dropping the rule would widen the tool | Set `tools` under `targets.copilot` |
| `skills` | Appended to the body as a `## Skills` list. Nothing is preloaded | Tell the agent to read them; see below |
| `model: inherit` | Dropped; Copilot inherits when no model is set | Nothing |
| `model: sonnet`, `opus`, `haiku` | Fails the Copilot build | Set a full model ID under `targets.copilot` |
| `effort` | `reasoningEffort` for `low`, `medium` and `high`; `xhigh` and `max` fail | Set it under `targets.copilot` |
| Every other field, such as `color`, `maxTurns`, `disallowedTools`, `memory`, `background`, `isolation` | Dropped, with a note | Restate a prohibition in the body |

Two of these lose a capability, not just a spelling:

- **Skills are not preloaded.** A Copilot agent has to be told to read them. Put a host block near the top of the body:

  ```markdown
  <!-- pluginfinity:only copilot -->
  ## Read first

  Before you act, read these skills: `release-rules`. This host does not preload them.
  <!-- /pluginfinity:only -->
  ```

- **`disallowedTools` disappears.** If the agent must not do something, say so in the body, next to the read-first block, where it holds on both hosts.

A field only Copilot has, such as `handoffs`, `mcp-servers` or `user-invocable`, goes under `targets.copilot` and is written as is. `targets: { copilot: false }` leaves the agent out of Copilot's build entirely.

On both hosts the agent's id is `<plugin>:<agent>`, which is what `copilot --agent` takes and what a `{{agent <name>}}` token writes.

## In a body, an agent is not a skill

- A bare `{{skill_dir}}` fails the build in an agent: an agent has no skill directory. `{{skill_dir <skill>}}` works on Claude Code only. For a file the agent should read, use a `pluginfinity://skill/<skill>/<path>` link.
- Nothing loads a skill because a file matches its `paths`. If the agent must read a skill before a kind of work, say so in the body.

## Check it

- Run `pluginfinity build`, then `pluginfinity build --check`.
- Read the notes under each target: `· agents/<name>.md: dropped color; tool-dropped Skill`. A tool you meant to keep shows up there first.
- Open the Copilot copy once and read it as the agent would: is every tool it is told to use in its list, and is every skill it is told to read named?
- For an agent whose behaviour depends on its preloads, test the builds, as this plugin does for its own agent: the Claude copy lists the skills, and the Copilot copy carries the read-first block.

## Common mistakes

- A description that names one user phrase, or that lists the agent's steps.
- `tools: Bash` when the agent runs only `git`; write `Bash(git *)`, and set Copilot's `tools` under `targets.copilot`.
- Relying on `hooks`, `mcpServers` or `permissionMode` in the frontmatter of an agent that only ships in a plugin.
- Listing every related skill in `skills`, so each start pays for all of them.
- A system prompt that says "continue what we were doing".
- No boundaries section.

## Go deeper

- [Skills and agents](../pluginfinity/references/components.md): frontmatter rules, `targets` blocks, host blocks, tokens and links.
- [What each host gets](../pluginfinity/references/targets.md): every agent field and tool name, and the measurements behind Copilot's tool names.
