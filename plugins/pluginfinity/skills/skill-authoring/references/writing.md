# What makes a skill worth loading

The frontmatter rules say what a skill may contain. This page is about what makes one worth the context it costs. It follows the Agent Skills guidance at agentskills.io (best practices and using scripts, read 2026-09-07).

## Start from real work

A skill written from general knowledge comes out vague: "handle errors appropriately", "follow best practices". The value is in the specifics an agent would not know. Two sources:

- **A task you did with an agent.** Keep the steps that worked, the corrections you had to make, the input and output formats, and the project facts the agent lacked.
- **The project's own material.** Runbooks, style guides, API specs, review comments, and the history of fixes, which shows what actually goes wrong.

Then run the skill on real tasks and feed everything back, not only the failures: what triggered it wrongly, what it missed, what could be cut.

## Spend context carefully

Once a skill loads, its whole body competes with the conversation and every other loaded skill.

- **Add what the agent lacks and leave out what it knows.** For each passage ask: would the agent get this wrong without it? If not, cut it. If you are not sure, test it. If the agent does the whole task well without the skill, the skill may add nothing.
- **Scope a skill like a function:** one coherent unit of work. Too narrow, and one task loads several skills that may disagree. Too broad, and it is hard to trigger precisely.
- **Aim for moderate detail.** Short steps with one working example beat exhaustive documentation. When you find yourself covering every edge case, leave most to the agent.
- **Put detail in references, and say when to read each.** The agent cannot judge a file by its name.

## How prescriptive to be

- **Give freedom where several approaches work.** Explain why, and the agent decides well in cases you did not foresee.
- **Be exact where an operation is fragile** or a sequence must be followed: "Run exactly this command. Do not add flags."
- **Calibrate each part separately.** Most skills hold both kinds.
- **Give a default, not a menu.** When several tools would do, pick one and mention the others briefly.
- **Prefer a procedure to a declaration.** "Run the migration, then check the row count" is followed; "migrations should be verified" is agreed with.

## Patterns that work

- **A gotchas section, in the body.** Concrete corrections to mistakes the agent will make: "The `users` table uses soft deletes; add `WHERE deleted_at IS NULL`." When you have to correct an agent, add the correction there.
- **A template for the output.** Agents match a concrete structure better than a description of one. Short templates go inline, long ones in `assets/`.
- **A checklist for a multi-step workflow**, so a step with a dependency is not skipped.
- **A validation loop:** do the work, run a validator, fix, repeat.
- **Plan, validate, execute** for a batch or destructive operation: write the plan in a structured form, check it with a script, then act. The validator's errors should say what was expected and what exists.
- **A bundled script** when the agent keeps rewriting the same logic.

## A script an agent can drive

An agent reads a script's stdout and stderr to decide what to do next.

- **Never wait for interactive input.** An agent cannot answer a prompt, and the script hangs. Take input from flags, the environment or stdin, and fail with a message that names the missing flag.
- **Document usage with `--help`,** briefly. It is how the agent learns the interface, and it enters the context.
- **Put structured data on stdout and diagnostics on stderr.** Prefer JSON or TSV to aligned text.
- **Write errors that say what was wrong, what was expected and what to try:** `Error: --format must be one of: json, csv. Received: "xml"`.
- **Be idempotent.** Agents retry.
- **Reject ambiguous input** instead of guessing.
- **Support `--dry-run`** for anything destructive or billed.
- **Use distinct, documented exit codes.**
- **Keep the output size predictable.** Many harnesses cut tool output past a limit without saying so. Default to a summary, or write to a file.

List the skill's scripts in `SKILL.md` so the agent knows they exist. The `bash-hooks` skill's scripts reference covers what a plugin script must do on each host: finding the plugin root, credentials, state and tests.

For a one-off command, pin the version (`npx eslint@9.0.0`) and state what must be installed.

## Four shapes

Naming a skill's shape settles most frontmatter questions.

| Shape | What it is | Invocation |
| :-- | :-- | :-- |
| Context | An index in `SKILL.md` and deep dives in `references/` | By description; often `user-invocable: false` |
| Workflow | A procedure the user starts, with `arguments` and `argument-hint` | `disable-model-invocation: true` when it has side effects |
| Pattern | Scripts under `scripts/` that do one concrete thing | By description |
| File-scoped | Rules for one kind of file, with a `paths` glob | By description, narrowed by `paths` |

A file-scoped skill still needs a description strong enough to trigger it: `paths` narrows automatic loading and never causes it.
