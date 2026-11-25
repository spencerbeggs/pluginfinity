# Proving a skill

A skill you never ran against real prompts is a guess. Two separate things can be wrong with it. The description may not fire on the prompts it should, or may fire on ones it should not. And the body may change nothing: an agent that already does the task well gives the same answer with or without it. A trigger eval tests the first and an output eval the second. A skill can pass one and still be worthless.

The method follows the Agent Skills guidance at agentskills.io (optimizing descriptions and evaluating skills, read 2026-09-07).

## Is an eval worth running?

Neither kind is free: every run is a model call.

- **Run a trigger eval** when the description could overlap another skill's, when it names a domain broad enough to fire on a passing mention, or when the skill must fire where the user does not name the domain.
- **Run an output eval** when the body makes a claim you have not watched an agent act on: a procedure, a gotcha, a script. A skill that only points at a reference, or restates what the agent already does, is the one most likely to add nothing, and an eval is how you find out.
- **Run neither yet** on a skill still changing shape with every edit.

## Trigger evals

1. **Write about 20 queries:** 8 to 10 that should trigger the skill and 8 to 10 that should not. Vary the phrasing, the detail and how explicit they are; include file paths, personal context and typos.
2. **Make the negatives near-misses** that share keywords and need something else. An obviously unrelated query tests nothing.
3. **Split them** about 60% train and 40% validation. Use only train failures to guide edits, or the description overfits to your phrasings.
4. **Run each query about 3 times** and compute a trigger rate. A positive passes at 0.5 or above; a negative passes below it.
5. **When a positive fails, find the category it stands for.** Do not paste its keywords into the description.
6. **Stop after about five rounds,** and keep the description with the best validation pass rate, which may not be the last one.

### The harness

`scripts/trigger-harness.sh` does steps 4 and the arithmetic. Put the positives and negatives in two files, one query per line:

```sh
bash "{{skill_dir}}/scripts/trigger-harness.sh" \
  --skill my-skill --positives train-pos.txt --negatives train-neg.txt \
  --transcript-dir /tmp/my-skill-evals --plugin-dir builds/claude --dry-run
```

- **It runs `claude -p` once per query per run, in a fresh process, and every run is billed.** `--dry-run` prints the plan and runs nothing. Twenty queries at three runs is sixty calls.
- **`--plugin-dir builds/claude` loads the plugin as built,** so build first. Without it the runs see the plugins the user has installed, which may be an older copy of the skill.
- **It prints one JSON line per query** with `triggered`, `runs` and `rate`. It applies no threshold; that is step 4.
- **Each run's transcript is kept** in `--transcript-dir`. Read one when a rate surprises you.
- **Check it on a query you know triggers the skill before you trust a zero.** All zeroes can mean the skill never fires or that the check does not match the transcript.
- **It is written for Claude Code.** Two functions hold everything specific to the client: `run_client`, which runs one query and writes a transcript, and `check_triggered`, which reads one. For Copilot or another client, replace those two with that client's command and whatever it records when a skill loads.

Run-to-run variance, where one query fires in some runs and not others, usually means the description is ambiguous for that query. Fix the ambiguity; do not rerun until the number looks right.

## Output evals

Run each case twice, with the skill and without it, so there is a baseline.

1. **Write 2 or 3 cases** before investing in more. A case is a realistic prompt, a description of success and any input files.
2. **Run both configurations, each in a clean context.** Start every run as its own fresh process or fresh agent. A run forked from the session that has been discussing the skill is not skill-free, and the comparison is void.
3. **Read the first pair of outputs, then write the assertions.** Until you have seen what the model produces, you are guessing at what good looks like.
4. **Grade strictly.** A pass needs concrete evidence. A section titled "Summary" holding one vague sentence is a fail.
5. **Drop every assertion that passes in both configurations.** It shows the model did that unaided, and keeping it inflates the pass rate. Do this after every run: a revision can turn a useful assertion into one that passes both ways.
6. **Revise, and rerun only what failed.**

When you are testing a change to an existing skill, the baseline is the previous version, not no skill. Copy the old `SKILL.md` and its references aside before you edit.

### Cases

Keep them beside the skill, in `evals/evals.json`:

```json
[
  {
    "id": "csv-with-missing-headers",
    "prompt": "Here's sales_q3.csv, can you total the revenue column?",
    "expected_output": "One number, and a note of which rows were skipped and why.",
    "files": ["sales_q3.csv"],
    "assertions": []
  }
]
```

- `id` is short, stable and kebab-case; it names the case's directory below.
- `prompt` is what a user would type, not a summary of the task.
- `expected_output` describes success for a human reader. It is not the literal output.
- `assertions` starts empty and is filled in after the first pair of runs.

Good assertions can be checked by a program, or are specific and observable, or countable. Weak ones are vague ("the output is good") or brittle (an exact phrase). Style and "feels right" belong to a human reading the output, not to an assertion.

`evals/` ships with the skill like any other support file. Keep it only if it is small and you want users to have it; otherwise keep the cases outside `skills/`.

### Workspace

One directory per round, per case, per configuration. Keep finished rounds: choosing the best one needs the earlier ones on disk.

```text
iteration-1/
  csv-with-missing-headers/
    with_skill/     outputs/  timing.json  grading.json
    without_skill/  outputs/  timing.json  grading.json
  benchmark.json
iteration-2/
```

- `outputs/` holds what the run produced: files, the transcript, the final message.
- `timing.json` holds that run's duration and token count.
- `grading.json` holds each assertion's result with its evidence.
- `benchmark.json` holds the round's pass rates, time and tokens for the two configurations, and the difference.

### Reading the results

| With the skill | Without | Meaning |
| :-- | :-- | :-- |
| Pass | Pass | No value from the skill here. Drop the assertion |
| Pass | Fail | The skill is earning its place. Keep it |
| Fail | Pass | The skill made this case worse. Treat it as a bug in the body |
| Fail | Fail | Look at the assertion first: it may be unverifiable, or outside what a skill can fix |

Read `benchmark.json` last. A skill that adds thirteen seconds for a fifty-point gain is worth shipping. One that doubles the tokens for two points has padding, not value.

When pass rates stop rising while rules keep accumulating, try removing instructions. And generalize from a failure instead of patching the one example: "Do X because Y causes Z" outperforms "ALWAYS do X".
