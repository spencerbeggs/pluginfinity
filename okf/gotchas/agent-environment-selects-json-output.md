---
type: Gotcha
title: Under Claude Code a plain pluginfinity doctor prints JSON, not the checklist
description: CLAUDECODE and AI_AGENT in the environment select the agent audience, so doctor and config errors come out as one JSON object even with no --agent flag; --human forces the checklist.
resource: ../../packages/cli/src/cli/run.ts
status: draft
stale_after: 2026-12-31T00:00:00Z
tags:
  - dx
sources:
  - id: run
    resource: ../../packages/cli/src/cli/run.ts
    title: The CliRuntime.main wiring that resolves the audience
  - id: doctor-command
    resource: ../../packages/cli/src/commands/doctor.ts
    title: The doctor command, which picks checklist or JSON by audience
  - id: effected-env
    resource: npm:@effected/env
    title: The agent and CI detection behind the audience, which reads CLAUDECODE, CLAUDE_CODE and AI_AGENT
generated:
  by: okfit/claude-code
  at: 2026-10-02T19:34:21Z
  body_sha256: 8269625cbeaf9e119f0cbcc76b6eefb4f653f5de9f6159bf537234725b3e6464
---

# Under Claude Code a plain pluginfinity doctor prints JSON, not the checklist

## What you see

Run `pluginfinity doctor` from a Claude Code session, through the Bash tool or a terminal it spawned, with no audience flag. It prints one line of JSON instead of the grouped Runtime, Hosts, Tools and Config checklist. A config error from `build` or `validate` likewise prints as a JSON object on stdout instead of a `✗` line on stderr. The same command in an ordinary terminal prints the checklist.

## What you will wrongly conclude

That the human renderer is broken, that `doctor` has no human output, or that the audience flags are not wired. You might then go looking for a renderer bug that does not exist.

## What is actually true

The output form follows the audience, and with no `--human`, `--agent`, `--ci` or `PLUGINFINITY_AUDIENCE` the audience is detected from the environment.[^run] Claude Code sets `CLAUDECODE=1` and an `AI_AGENT` value such as `claude-code_<version>_agent` in the processes it starts, and `@effected/env` reads either as an agent environment.[^effected-env] `doctor` then prints its JSON form.[^doctor-command] This is intended: an agent gets the structured output it can parse.

To see what a person sees, pass `--human`:

```sh
pluginfinity doctor --human
```

Tests that assert on the checklist or on stderr text should pass `--human` explicitly, so they do not depend on the environment they run in.

[^run]: `../../packages/cli/src/cli/run.ts`
[^effected-env]: `npm:@effected/env`
[^doctor-command]: `../../packages/cli/src/commands/doctor.ts`
