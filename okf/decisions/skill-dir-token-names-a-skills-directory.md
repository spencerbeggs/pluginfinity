---
type: Decision
title: A skill_dir token names a skill's directory, as a placeholder on Copilot
description: Body tokens gain a fifth kind, {{skill_dir}} and {{skill_dir <skill>}}, which Claude Code spells as a path variable and Copilot as a placeholder the model resolves from the base-directory line, because Copilot expands no path in bodies.
status: draft
tags:
  - portability
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
    title: Approved the token and its spellings while approving the session env design
  - id: tokens
    resource: ../../packages/engine/src/tokens.ts
    title: The skill_dir kind and its problems
  - id: claude-target
    resource: ../../packages/targets/src/claude.ts
    title: Claude Code's dirSpelling
  - id: copilot-target
    resource: ../../packages/targets/src/copilot.ts
    title: Copilot's dirSpelling, unresolved from an agent
  - id: probes
    resource: ../measurements/host-runtime-probes-2026-10-07.md
    title: Both hosts insert the base directory line when a skill is invoked
generated:
  by: okfit/claude-code
  at: 2026-10-07T06:53:05Z
  body_sha256: 9931777a8d57c680737edbb7d6db16c84417e88ad78a8721aa432432181989c9
---

# A skill_dir token names a skill's directory, as a placeholder on Copilot

## Context

A skill that runs its own script or reads a bundled file has to name the skill's directory. [The body-token decision](body-tokens-and-links-are-built-per-target.md) fixed four token kinds and has no way to say it, and a skill script cannot rely on `CLAUDE_SKILL_DIR`, which a downstream measured unset in the Bash tool. Claude Code expands `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` in skill bodies, while Copilot expands no path in a body; both hosts insert `Base directory for this skill: <path>` above the skill when it is invoked.[^probes]

## Decision

- **`{{skill_dir}}`** names the directory of the skill whose body it is written in, and **`{{skill_dir <skill>}}`** that of the named skill. The kind is a fifth token, and the body-token decision's four-kind rule is extended, not replaced, so a `{{` whose first word is another word is still plain text.[^tokens]
- **Each target spells it from data**, in `skills.dirSpelling` of its description: `own`, `other` (a template with `{skill}`) and `agent`. Claude Code writes `${CLAUDE_SKILL_DIR}` for the own skill and `${CLAUDE_PLUGIN_ROOT}/skills/<skill>` for another, from a skill or an agent. Copilot writes the placeholder `<skill base directory>` and `<skill base directory>/../<skill>`, which the model fills in from the base-directory line; it is not a literal path.[^claude-target][^copilot-target]
- **An agent has no skill directory**, so the bare form in an agent body is a build problem, and Copilot has no spelling for a named skill from an agent, so that is a problem too, as are an unknown skill and one the target does not build. The token takes neither a `|` fallback nor backticks.
- **Versus a `pluginfinity://skill/` link:** a link is for prose that points at a file, built in the target's reference style; `{{skill_dir}}` is for a command or path the model will run or read.

## Consequences

- A skill script can be run by path on both hosts without relying on an unset variable; on Copilot the path is a placeholder the model resolves, so a skill that runs a script says what it is.
- `renderSkill` gives each skill body and bundled `.md` file a token context that carries its own skill name.

[^probes]: [Host runtime probes, 2026-10-07](../measurements/host-runtime-probes-2026-10-07.md)
[^tokens]: `../../packages/engine/src/tokens.ts`
[^claude-target]: `../../packages/targets/src/claude.ts`
[^copilot-target]: `../../packages/targets/src/copilot.ts`
