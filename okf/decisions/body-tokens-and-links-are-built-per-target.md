---
type: Decision
title: Body tokens and pluginfinity links are built per target
description: "Skill and agent bodies name tools, agents, skills and the plugin root through explicit {{kind name}} tokens, and other components through inline pluginfinity:// links, which each target spells from its own data; anything a target cannot spell fails the build, with host blocks as the escape hatch."
status: stable
tags:
  - portability
  - dx
sources:
  - id: okfit-findings-round-2
    resource: okfit round-2 dogfood findings mail, 2026-10-05
    title: okfit's round-2 dogfood findings, friction items 1 and 2
    last_modified: 2026-10-05T00:00:00Z
  - id: owner-rulings
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-06T00:00:00Z
    title: The body tokens and links design and its review rulings
  - id: tokens
    resource: ../../packages/engine/src/tokens.ts
    title: renderTokens, TokenContext and TokenProblem
  - id: core-target
    resource: ../../packages/core/src/target.ts
    title: tools.runtime, agents.id and skills.invoke on the Target schema
  - id: copilot-target
    resource: ../../packages/targets/src/copilot.ts
    title: Copilot's run-time names
generated:
  by: okfit/claude-code
  at: 2026-10-06T02:28:06Z
  body_sha256: 4597ba43f529482b9ba59255dd18a4ca4fe1773d8b77162e52be63f3d49b50ca
verified:
  - by: human:spencer
    at: 2026-10-06T03:11:19Z
---

# Body tokens and pluginfinity links are built per target

## Context

Until now, okfit's Copilot build named `mcp__plugin_okfit_mcp__get_concept` in skill prose, where the Copilot model sees `mcp-get_concept`, and `--agent okf-docs` failed on Copilot because it namespaces agent ids as `okfit:okf-docs`.[^okfit-findings-round-2] Frontmatter was translated per target; prose was not. `pluginfinity://` links were refused outside code, because nothing built them.

## Decision

- **Explicit tokens.** A body names a host-specific thing with `{{tool <name>}}`, `{{agent <name>}}`, `{{skill <name>}}` or `{{plugin_root}}`, on one line, and each target writes its own bare spelling.[^tokens] Only marked text changes.
- **Only the four kinds are tokens.** A `{{` whose first word is anything else, such as GitHub Actions' `${{ … }}`, Jinja or Handlebars, is plain text. `\{{` drops its backslash only before a token; elsewhere the backslash stays.[^owner-rulings]
- **Tokens are replaced everywhere, code included,** so a code sample shows the host's real name. A literal token is written `\{{`.
- **Each target names ids by its own plugin name.** `{{agent …}}`, `{{skill …}}` and agent links use the plugin's name on that target (its `<target>.name` override, else `name`), because that is the name the host installs it under. A plugin's own MCP tool is written, and its run-time `{plugin}` filled, with the Claude name, which Claude Code namespaces MCP tools with.
- **Links are built in the same pass.** An inline `[text](pluginfinity://skill/<skill>[/<path>][#anchor])` or `[text](pluginfinity://agent/<agent>)` outside code is built in the target's reference style: a path under the body root, anchor kept, or prose, anchor dropped. An agent link renders the agent's id and takes no anchor. A link in code stays text, as a sample.
- **Nothing unbuilt ships.** Any other `pluginfinity://` outside code, a reference definition, an autolink, an image, a title, a bare URL, in any case, fails the build.
- **What cannot be spelled fails.** An unknown agent or skill, a missing file, a missing or extra argument, an unclosed token and a value the target leaves unresolved are each a `ComponentInvalid` on the file, keyed by line and naming the target. A host block is the escape hatch, since a token in another target's block is never read.
- **Scope.** `SKILL.md`, every other `.md` file in a skill directory and agent bodies; never frontmatter, scripts or other files.
- **Targets stay data.** The spellings are new `Target` fields, `tools.runtime`, `agents.id` and `skills.invoke`, beside the existing `pluginRoot.body` and `references.style`.[^core-target] Copilot's values come from [the run-time names measurement](../measurements/copilot-runtime-names.md), and an unmeasured name is `unresolved`.[^copilot-target]

## Consequences

- Authors write a tool, agent or skill name once and both hosts read their own, including this plugin's MCP tools as `<server>-<tool>` on Copilot.
- `renderSkill` and `renderAgent` take a required `TokenContext`, and the engine's `referenceLines` export is gone.
- `{{plugin_root}}` and every unmeasured Copilot tool fail the Copilot build until measured, so a body that needs one uses a host block.
- Known limits: an indented code block is not treated as code, an inline code span across two lines is not recognised, and `\[text](pluginfinity://…)` is still built and keeps its backslash.
- Copilot's frontmatter tool aliases are unchanged; whether `search`, `web` and `todo` grant anything is open.

## Alternatives rejected

- **Rewrite tool and agent names automatically.** It would also rewrite text meant literally, such as a skill that teaches Claude Code's own tool names.
- **Treat every `{{…}}` as a token.** A body that shows a GitHub Actions workflow or a template would fail or need escapes it never needed before.
- **Leave tokens alone inside code.** A code sample is where a model copies a tool or agent name from, so it must carry the host's name.
- **Keep refusing links, or ship them as text.** Refusing pushes authors to relative links that cannot reach another skill's file on Copilot, and shipping the scheme gives the host a link it cannot follow.
- **A general template engine.** Conditionals and loops belong to host blocks, which already exist.

[^okfit-findings-round-2]: okfit round-2 dogfood findings mail, 2026-10-05
[^owner-rulings]: conversation with the repository owner, 2026-10-06
[^tokens]: `../../packages/engine/src/tokens.ts`
[^core-target]: `../../packages/core/src/target.ts`
[^copilot-target]: `../../packages/targets/src/copilot.ts`
