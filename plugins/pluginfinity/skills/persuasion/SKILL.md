---
name: persuasion
description: >-
  Use when writing or reviewing text meant to change what an agent does: the text a hook adds to the
  model's context, a deny or block reason, a SKILL.md body or description, or an agent's system prompt.
  Covers how much force to use (four tiers, and why the plain one is the default), XML tags for injected
  text, what each hook event can deliver on Claude Code and GitHub Copilot, and templates for SessionStart,
  PreToolUse and PostToolUse.
---

# Writing text that changes what an agent does

Text aimed at an agent works or fails on three things: how much force it uses, how it is structured, and when it arrives. This skill covers the wording. The mechanics of sending it are in the `bash-hooks` skill (the script) and the [hook-events](../hook-events/SKILL.md) skill (what each event can do on each host).

## Start plain

Current Claude models follow a system prompt and injected context closely. Anthropic's prompting guide says that prompts written to stop older models from skipping a tool or skill now make the model overuse it, and that the fix is to soften the language: where you wrote "CRITICAL: You MUST use this tool when…", write "Use this tool when…" ([Anthropic's prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), read 2026-11-25).

So the default is a plain instruction with its reason. Raise the force only when you have seen the plain form ignored, or when ignoring it once does real damage. And where a rule must hold, do not rely on wording at all: have the hook deny or block.

## Four tiers of force

Match the tier to what happens if the agent ignores the text.

| Tier | Use it when | Wording | Tag |
| :-- | :-- | :-- | :-- |
| 1. Non-negotiable | Ignoring it breaks something the user will see: data loss, a skipped gate, a required sequence | "You MUST", "No exceptions", "Even if you think…" | `<EXTREMELY_IMPORTANT>` |
| 2. Strong default | A practice to follow unless a named exception applies | "Use X. Use Y only when…" | `<important>` |
| 3. Reminder | The agent did, or is about to do, something that works but is not the preferred way | "You may continue. Next time, prefer…" | `<reminder>` |
| 4. Explainer | The agent's choice was acceptable; you want it to know the convention and when each way fits | "You did X. Y is preferred because… X is still right when…" | `<observation>` |

Rules that hold across the tiers:

- **Most text is tier 2 or 3.** A plugin with tier 1 on every event teaches the agent to discount tier 1.
- **Tier 1 closes the escape route.** It names the moment ("before any response", "before the first edit"), the one action, and why a special case does not exempt the agent. Use it for a discipline such as test-first, for a destructive action, or for a required tool sequence. Never for style.
- **Tier 2 names its exceptions.** "Use the MCP tool. Use the bare command only when debugging the tool itself or running outside a session." Without the list, an agent under pressure decides its case is special. With it, the agent matches an exception or follows the default.
- **Tier 3 says no action is needed.** A reminder that reads as "switch now" is a tier 2 with weak wording. Pick one.
- **Tier 4 describes and does not command.** It is the teaching tier: over a session these build the agent's picture of how the project works.
- **Every tier says what to do.** "Be careful with deletes" changes nothing. "Before `rm -rf`, confirm the path with the user" does.

### Templates

Tier 1:

```text
<EXTREMELY_IMPORTANT>
This project is test-first. Before you write or change production code, write a failing test and run it.

If you have written production code without a failing test, delete it and start from the test. This
holds for small changes and for "obvious" fixes: those are where the untested regressions come from.
</EXTREMELY_IMPORTANT>
```

Tier 2:

```text
<important>
Run tests with the run_tests tool. It records each run, and the later checks read that record.

Use the bare `vitest` command only when:
- you are debugging the run_tests tool itself
- you are testing one fixture in isolation
</important>
```

Tier 3:

```text
<reminder>
You ran `pnpm vitest run` directly. This project's run_tests tool records the run, which the later
checks read. You may continue; no action is needed now. For the next test run, prefer the tool.
</reminder>
```

Tier 4:

```text
<observation>
You read the file with `cat … | head -20`. The file-reading tool is preferred for a known path: it gives
line numbers and handles large files. `head` is still right when you are piping into another command.
</observation>
```

## Structure injected text with XML tags

Anthropic's guide: XML tags help Claude parse a prompt that mixes instructions, context and examples. Text a hook injects lands among user messages, tool results and other plugins' injections, so it needs a clear boundary more than most.

- Wrap each injection in one tag, named for what it is: `<reminder>`, `<verification_required>`. Not `<note1>`.
- Use capitals only for tier 1.
- Use underscores in compound names.
- Inside the tag, lists and inline code are fine. The tag is the structure.

In a SKILL.md or an agent's system prompt, Markdown headings are the structure. Keep XML there for a block that must stand apart, such as a rule that outranks the rest of the page.

## What each hook can deliver

The same script runs on both hosts, and the hook library sends a response only where the host honours it. Where it does not, the hook does nothing, so check the host you care about before you rely on a slot.

| Slot | Send it with | Claude Code | Copilot |
| :-- | :-- | :-- | :-- |
| Session start | `hook_context` | Yes | Yes |
| The user's prompt | `hook_context` on `UserPromptSubmit` | Yes | No |
| Before a tool call | `hook_context` on `PreToolUse` | Yes | No |
| Before a tool call, refusing it | `hook_deny "<reason>"` | Yes | Yes |
| Before a tool call, rewriting it | `hook_allow "<reason>" '<input json>'` | Yes | Yes |
| After a tool call | `hook_context` on `PostToolUse` | Yes | Yes |
| When the agent stops | `hook_block "<reason>"` on `Stop` or `SubagentStop` | Yes | Yes |
| A subagent starting | `hook_context` on `SubagentStart` | Yes | Yes |

A native hook sends the same with `h.context`, `h.deny`, `h.allowWith` and `h.block`. The full table, with the events only Claude Code has, is in the `hook-events` skill.

- **A reminder before a tool call reaches Copilot only as a deny.** If the text matters on both hosts, either deny with the reason, or move the reminder to `PostToolUse`.
- **`hook_system_message` is for the user, not the model.** It is shown in the transcript and is not added to context, and only on Claude Code.
- **Name tools as the host spells them.** The Copilot model sees `view` and `bash`, not `Read` and `Bash`. In a hook, build the name with `hook_tool_name Read`; in a skill or agent body, write a `\{{tool Read}}` token.

### Session start

The first thing the model reads, and the cheapest place to set a rule for the whole session.

```bash
#!/usr/bin/env bash
. "$(dirname "$0")/lib/pluginfinity/hook.sh"

hook_context "$(cat <<'EOF'
<important>
This project has three rules:
1. Test-first. Read the tdd skill before you write a test.
2. Run tests with the run_tests tool, not the bare command.
3. Never edit a file under builds/. Edit the source and rebuild.
</important>
EOF
)"
```

- **Send a short list and leave the detail in skills.** The model loads a skill when it needs one, and the session keeps its context.
- **Inject a whole skill body only for a discipline that fails when the model skips the skill.** Read the file from `$(hook_plugin_root)/skills/<skill>/SKILL.md` and wrap it in one tag. Every session pays for it, so measure whether the short list was really being ignored first.
- **One plugin, one session-start injection.** Two hooks that each open with a top-tier block compete with each other.

### Before a tool call

Where a rule must hold, deny. The reason is the only thing the model sees, so write it as an instruction with the next step in it:

```bash
case "$(hook_input tool_input.command)" in
*"git push --force"*)
  hook_deny "Force pushes need the user's say-so. Ask: 'Force-push to <branch>?' If they agree, retry with --force-with-lease. If not, push normally." ;;
*) hook_noop ;;
esac
```

When the call is nearly right, rewrite it with `hook_allow "<reason>" '<input json>'` and say in the reason what changed, so the agent learns the convention and does not repeat the original.

### After a tool call

The teaching slot: the agent has just seen what its action did.

- **Say nothing on success.** Send `hook_noop`. Praise is noise.
- **Tier 3 or 4 for a first slip.** The work is done; redoing it is rarely worth it.
- **Escalate on repeats, once.** If the same slip happens again in the session, the second reminder can be tier 2. Keep the count in a file under the plugin's data directory, keyed by session: the `bash-hooks` skill's scripts reference covers state for a script, and a native hook has `h.dataDir` and `h.writeFile`.
- **Do not send the same text every time.** An agent discounts a line it has seen five times. After the escalation, stop.

## Skill bodies, descriptions and agent prompts

The same calibration applies where nothing is injected.

- **A description says when to use the thing, not what it does step by step.** "Use when…", third person. A description that summarizes the workflow gets followed in place of the body.
- **Lead with the instruction, then the reason.** A rule with its reason is followed in the cases you did not think of; a bare rule is followed only to the letter.
- **Bold the rule, not the paragraph.** One emphasized sentence per bullet. A page where everything is bold has no emphasis.
- **Keep capitals and "MUST" for what is tier 1.** A skill that shouts throughout makes the model apply it where it does not belong.
- **Name the exception next to the rule** it belongs to, not in a section at the end.

## Which persuasion principles to use

Meincke et al. (2025) tested Cialdini's principles on language models across about 28,000 conversations and found compliance roughly doubled when a request used them. For text aimed at an agent:

| Principle | Use | Avoid |
| :-- | :-- | :-- |
| Authority: direct, imperative wording | Tier 1 | Stacking it: five tier 1 blocks in a session weaken each one |
| Commitment: no ambiguous escape route | Every tier, as a named exception or a closed loophole | Leaving the exception vague; an agent under pressure widens it |
| Scarcity: bound to a moment | "Before any response", "right after the test passes" | Invented urgency |
| Social proof: this is how it is done here | An established convention of the project | A pattern that is not established; it reads as a bluff |
| Unity: "we", "our codebase" | Tiers 3 and 4 | Tier 1, where it weakens the instruction |
| Reciprocity, liking | Never | They produce flattery and agreement, not correct work |

## Review checklist

1. **Could a hook enforce this?** If the rule must hold, deny or block, and write the reason as the instruction.
2. **Does the tier match the consequence?** Tier 1 only where ignoring it once does damage.
3. **Would the plain form do?** Try it first; add force only when it was ignored.
4. **Does it say what to do**, not only what was wrong?
5. **Tier 2: is the exception named?** Tier 3: does it say no action is needed?
6. **Is injected text in one tag** whose name says what it is?
7. **Does the slot exist on both hosts?** Check the table; move or duplicate the text where Copilot drops it.
8. **Are tool names spelled for the host** that will read them?
9. **Do the plugin's hooks agree with each other** and with its skills? Session start saying one tool and a later reminder saying another cancels both.
10. **Is success silent?**
