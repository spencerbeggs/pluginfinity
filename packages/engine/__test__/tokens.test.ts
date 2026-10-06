import { assert, describe, it } from "@effect/vitest";
import { Target, unresolved } from "@pluginfinity/core";
import { CLAUDE, COPILOT } from "@pluginfinity/targets";
import { applyHostBlocks } from "../src/body.js";
import { renderTokens } from "../src/tokens.js";
import { tokenContext } from "./utils/token-context.js";

const ROOT = `\${CLAUDE_PLUGIN_ROOT}`;
const claude = tokenContext(CLAUDE);
const copilot = tokenContext(COPILOT);

const text = (result: ReturnType<typeof renderTokens>): string => {
	if (!("text" in result)) assert.fail(`expected text, got problems ${JSON.stringify(result.problems)}`);
	return result.text;
};

const problems = (result: ReturnType<typeof renderTokens>): ReadonlyArray<{ line: number; message: string }> => {
	if (!("problems" in result)) assert.fail(`expected problems, got text ${JSON.stringify(result.text)}`);
	return result.problems;
};

describe("renderTokens: tools", () => {
	it("keeps a built-in name on Claude and spells it at run time on Copilot", () => {
		assert.strictEqual(text(renderTokens("Use {{tool Read}}.", claude)), "Use Read.");
		assert.strictEqual(text(renderTokens("Use {{tool Read}}.", copilot)), "Use view.");
		assert.strictEqual(text(renderTokens("{{tool Write}} or {{tool Bash}}", copilot)), "create or bash");
	});

	it("spells this plugin's own MCP tool through the run-time template", () => {
		const name = "{{tool mcp__plugin_demo_mcp__get_concept}}";
		assert.strictEqual(text(renderTokens(name, claude)), "mcp__plugin_demo_mcp__get_concept");
		assert.strictEqual(text(renderTokens(name, copilot)), "mcp-get_concept");
	});

	it("splits an own MCP name at the first separator that leaves a declared server", () => {
		const ctx = tokenContext(COPILOT, { own: { plugin: "demo", servers: new Set(["a__b"]) } });
		assert.strictEqual(text(renderTokens("{{tool mcp__plugin_demo_a__b__tool}}", ctx)), "a__b-tool");
	});

	it("keeps another plugin's MCP tool on Claude and fails it on Copilot", () => {
		const name = "{{tool mcp__plugin_other_srv__do}}";
		assert.strictEqual(text(renderTokens(name, claude)), "mcp__plugin_other_srv__do");
		const [problem] = problems(renderTokens(name, copilot));
		assert.strictEqual(problem?.line, 1);
		assert.include(problem?.message, "mcp__plugin_other_srv__do");
	});

	it("names ids by the target's plugin name and own MCP tools by the Claude name", () => {
		const ctx = tokenContext(COPILOT, { plugin: "x" });
		assert.strictEqual(text(renderTokens("{{agent reviewer}} {{skill alpha}}", ctx)), "x:reviewer /x:alpha");
		assert.strictEqual(text(renderTokens("{{tool mcp__plugin_demo_mcp__get_concept}}", ctx)), "mcp-get_concept");
		const claudeCtx = tokenContext(CLAUDE, { plugin: "x" });
		assert.strictEqual(
			text(renderTokens("{{tool mcp__plugin_demo_mcp__get_concept}}", claudeCtx)),
			"mcp__plugin_demo_mcp__get_concept",
		);
	});

	it("fails an own MCP tool on Copilot when the server is not declared", () => {
		assert.lengthOf(problems(renderTokens("{{tool mcp__plugin_demo_nope__x}}", copilot)), 1);
	});

	it("fails a tool the target marks unresolved, carrying the target's note", () => {
		const [problem] = problems(renderTokens("{{tool TodoWrite}}", copilot));
		assert.include(problem?.message, "TodoWrite");
		assert.include(problem?.message, "No todo tool appeared");
	});

	it("keeps an unlisted name on Claude", () => {
		assert.strictEqual(text(renderTokens("{{tool ToolSearch}}", claude)), "ToolSearch");
	});
});

describe("renderTokens: agents, skills and the plugin root", () => {
	it("renders an agent id on both targets", () => {
		assert.strictEqual(text(renderTokens("{{agent reviewer}}", claude)), "demo:reviewer");
		assert.strictEqual(text(renderTokens("{{agent reviewer}}", copilot)), "demo:reviewer");
	});

	it("renders a skill invocation on both targets", () => {
		assert.strictEqual(text(renderTokens("Run {{skill alpha}}.", claude)), "Run /demo:alpha.");
		assert.strictEqual(text(renderTokens("Run {{skill alpha}}.", copilot)), "Run /demo:alpha.");
	});

	it("renders the plugin root on Claude and fails it on Copilot", () => {
		assert.strictEqual(text(renderTokens("{{plugin_root}}/bin", claude)), `${ROOT}/bin`);
		const [problem] = problems(renderTokens("{{plugin_root}}/bin", copilot));
		assert.include(problem?.message, "{{plugin_root}}");
		assert.include(problem?.message, "plugin-root expansion");
	});

	it("fails a skill invocation the target marks unresolved", () => {
		const target = Target.make({ ...COPILOT, skills: { ...COPILOT.skills, invoke: unresolved("no skill command") } });
		const [problem] = problems(renderTokens("{{skill alpha}}", tokenContext(target)));
		assert.include(problem?.message, "{{skill alpha}}");
		assert.include(problem?.message, "no skill command");
	});

	it("fails an agent or skill that is not in this plugin", () => {
		const found = problems(renderTokens("{{agent ghost}}\n{{skill ghost}}", claude));
		assert.deepStrictEqual(
			found.map((p) => p.line),
			[1, 2],
		);
		assert.include(found[0]?.message, "ghost");
	});

	it("allows whitespace inside the braces", () => {
		assert.strictEqual(text(renderTokens("{{  tool   Read  }} {{ plugin_root }}", claude)), `Read ${ROOT}`);
	});
});

describe("renderTokens: grammar and malformed input", () => {
	it("leaves braces whose first word is not a kind as text, in prose and code", () => {
		const lines = [
			"$" + "{{ secrets.GITHUB_TOKEN }}",
			"Hello {{ name }} and {{}}",
			"{{tol Read}} {{toolbox}} {{ tool.x }}",
			"{{ unknown and never closed",
		];
		const body = [...lines, `\`$\{{ secrets.GITHUB_TOKEN }}\` and \`{{ name }}\``, "```yaml", ...lines, "```"].join(
			"\n",
		);
		for (const ctx of [claude, copilot]) assert.strictEqual(text(renderTokens(body, ctx)), body);
	});

	it("replaces a known token on a line that also holds unknown braces", () => {
		assert.strictEqual(text(renderTokens("{{ name }} uses {{tool Read}}", copilot)), "{{ name }} uses view");
	});

	it("fails a kind missing its argument", () => {
		for (const kind of ["tool", "agent", "skill"]) {
			const [problem] = problems(renderTokens(`{{${kind}}}`, claude));
			assert.include(problem?.message, `{{${kind}}}`);
			assert.include(problem?.message, kind === "agent" ? "needs an agent name" : `needs a ${kind} name`);
		}
	});

	it("fails a token with too many arguments, and the plugin root with one", () => {
		assert.lengthOf(problems(renderTokens("{{tool Read Write}}", claude)), 1);
		assert.lengthOf(problems(renderTokens("{{plugin_root x}}", claude)), 1);
	});

	it("fails a token that is never closed on its line", () => {
		const [problem] = problems(renderTokens("ok\n{{ tool Read\n}}", claude));
		assert.strictEqual(problem?.line, 2);
		assert.include(problem?.message, "never closed");
	});

	it("leaves a lone closing pair as text", () => {
		assert.strictEqual(text(renderTokens("a }} b", copilot)), "a }} b");
	});

	it("starts a token at the double brace right before its kind, so a third brace is text", () => {
		assert.strictEqual(text(renderTokens("{{{tool Read}}}", copilot)), "{view}");
		// The backslash escapes "{{{", which is not a token, so it stays and the inner token renders.
		assert.strictEqual(text(renderTokens("\\{{{tool Read}}}", copilot)), "\\{view}");
	});

	it("fails a known token that holds another brace", () => {
		const [problem] = problems(renderTokens("{{tool {{x}}}}", claude));
		assert.include(problem?.message, "{{tool {{x}}");
	});

	it("never throws on brace soup", () => {
		for (const input of ["{{", "}}", "{{{", "}}}", "{{{{}}}}", "\\{{", "{{tool {{tool Read}}}}", "{{\\{{}}", "{"]) {
			assert.doesNotThrow(() => renderTokens(input, copilot));
		}
	});

	it("renders a CRLF body byte for byte apart from the replacement", () => {
		const body = "# Title\r\n\r\nUse {{tool Read}} now.\r\n```\r\n{{tool Write}}\r\n```\r\n";
		assert.strictEqual(text(renderTokens(body, copilot)), "# Title\r\n\r\nUse view now.\r\n```\r\ncreate\r\n```\r\n");
	});

	it("reports the right lines for problems in a CRLF body", () => {
		const body = "ok\r\n{{tool TodoWrite}}\r\n\r\n[x](pluginfinity://agent/ghost)\r\n";
		assert.deepStrictEqual(
			problems(renderTokens(body, copilot)).map((p) => p.line),
			[2, 4],
		);
	});

	it("leaves text without tokens or links byte for byte", () => {
		const body = "# Title\r\n\nPlain { braces } and `code`.\n";
		assert.strictEqual(text(renderTokens(body, copilot)), body);
	});
});

describe("renderTokens: the escape", () => {
	it("renders an escaped token literally on both targets, dropping the backslash", () => {
		assert.strictEqual(text(renderTokens("\\{{tool Read}}", claude)), "{{tool Read}}");
		assert.strictEqual(text(renderTokens("\\{{tool Read}}", copilot)), "{{tool Read}}");
	});

	it("honours the escape inside fenced and inline code", () => {
		const body = ["`\\{{plugin_root}}`", "```sh", "echo \\{{tool Read}} \\{{ x }}", "```"].join("\n");
		assert.strictEqual(
			text(renderTokens(body, copilot)),
			["`{{plugin_root}}`", "```sh", "echo {{tool Read}} \\{{ x }}", "```"].join("\n"),
		);
	});

	it("keeps the backslash before a double brace that is not a token", () => {
		for (const ctx of [claude, copilot]) {
			assert.strictEqual(text(renderTokens("$" + "{{ github.ref }}", ctx)), "$" + "{{ github.ref }}");
			assert.strictEqual(text(renderTokens("$\\{{ github.ref }}", ctx)), "$\\{{ github.ref }}");
		}
	});

	it("leaves a regex sample with an escaped brace untouched in code and prose", () => {
		const body = ["Match `/\\{{2}/` here.", "```js", "const twin = /\\{{2}/;", "```", "/a\\{{2,3}/"].join("\n");
		for (const ctx of [claude, copilot]) assert.strictEqual(text(renderTokens(body, ctx)), body);
	});
});

describe("renderTokens: code", () => {
	it("replaces tokens inside fenced and inline code", () => {
		const body = ["Use `{{tool Read}}`.", "```", "{{tool Write}}", "```"].join("\n");
		assert.strictEqual(text(renderTokens(body, copilot)), ["Use `view`.", "```", "create", "```"].join("\n"));
	});

	it("leaves links in code literal while replacing a token beside them", () => {
		const body = [
			"`[g](pluginfinity://skill/alpha)` then {{tool Read}}",
			"~~~",
			"[g](pluginfinity://agent/reviewer) {{tool Read}}",
			"~~~",
		].join("\n");
		assert.strictEqual(
			text(renderTokens(body, copilot)),
			["`[g](pluginfinity://skill/alpha)` then view", "~~~", "[g](pluginfinity://agent/reviewer) view", "~~~"].join(
				"\n",
			),
		);
	});
});

describe("renderTokens: links", () => {
	it("renders a skill file link as a path on Claude and prose on Copilot", () => {
		const link = "See [the guide](pluginfinity://skill/alpha/references/guide.md).";
		assert.strictEqual(text(renderTokens(link, claude)), `See [the guide](${ROOT}/skills/alpha/references/guide.md).`);
		assert.strictEqual(text(renderTokens(link, copilot)), "See the guide (the `alpha` skill's `references/guide.md`).");
	});

	it("renders a bare skill link to SKILL.md on Claude and the skill on Copilot", () => {
		const link = "[beta](pluginfinity://skill/beta)";
		assert.strictEqual(text(renderTokens(link, claude)), `[beta](${ROOT}/skills/beta/SKILL.md)`);
		assert.strictEqual(text(renderTokens(link, copilot)), "beta (the `beta` skill)");
	});

	it("renders an agent link as prose with the agent id on both targets", () => {
		const link = "[review](pluginfinity://agent/reviewer)";
		assert.strictEqual(text(renderTokens(link, claude)), "review (`demo:reviewer`)");
		assert.strictEqual(text(renderTokens(link, copilot)), "review (`demo:reviewer`)");
	});

	it("replaces a token inside a link's text", () => {
		assert.strictEqual(
			text(renderTokens("[{{tool Read}} it](pluginfinity://agent/reviewer)", copilot)),
			"view it (`demo:reviewer`)",
		);
	});

	it("builds a link whose text holds inline code", () => {
		assert.strictEqual(
			text(renderTokens("[`reviewer`](pluginfinity://agent/reviewer)", copilot)),
			"`reviewer` (`demo:reviewer`)",
		);
	});

	it("fails a link to a missing skill, a missing file, or a missing agent", () => {
		const body = [
			"[a](pluginfinity://skill/ghost)",
			"[b](pluginfinity://skill/alpha/nope.md)",
			"[c](pluginfinity://agent/ghost)",
		].join("\n");
		for (const ctx of [claude, copilot]) {
			const found = problems(renderTokens(body, ctx));
			assert.deepStrictEqual(
				found.map((p) => p.line),
				[1, 2, 3],
			);
			assert.include(found[1]?.message, "alpha/nope.md");
		}
	});

	it("fails an unknown link kind, a nameless link, and an agent link with a path", () => {
		const body = [
			"[a](pluginfinity://hook/x)",
			"[b](pluginfinity://skill)",
			"[c](pluginfinity://agent/reviewer/x)",
		].join("\n");
		assert.deepStrictEqual(
			problems(renderTokens(body, claude)).map((p) => p.line),
			[1, 2, 3],
		);
	});

	it("fails a pluginfinity link it cannot parse rather than ship it, quoting it", () => {
		const found = problems(
			renderTokens('[a](pluginfinity://skill/alpha "title")\n![i](pluginfinity://skill/alpha)', claude),
		);
		assert.deepStrictEqual(
			found.map((p) => p.line),
			[1, 2],
		);
		assert.include(found[0]?.message, "[a](pluginfinity://skill/alpha");
		assert.include(found[0]?.message, "only inline links");
	});

	it("fails a reference definition, an autolink and an uppercase scheme, on both targets", () => {
		const cases = [
			["[r]: pluginfinity://skill/alpha", "pluginfinity://skill/alpha"],
			["See <pluginfinity://agent/reviewer>.", "<pluginfinity://agent/reviewer>."],
			["[a](PLUGINFINITY://skill/alpha)", "[a](PLUGINFINITY://skill/alpha)"],
			["bare Pluginfinity://skill/beta text", "Pluginfinity://skill/beta"],
		] as const;
		for (const ctx of [claude, copilot]) {
			for (const [body, quoted] of cases) {
				const [problem] = problems(renderTokens(body, ctx));
				assert.strictEqual(problem?.line, 1);
				assert.include(problem?.message, quoted);
				assert.include(problem?.message, "only inline links");
			}
		}
	});

	it("fails a stray pluginfinity:// glued to a built link, on both targets", () => {
		for (const ctx of [claude, copilot]) {
			const [problem, ...rest] = problems(renderTokens("[a](pluginfinity://skill/alpha)pluginfinity://bogus", ctx));
			assert.strictEqual(problem?.line, 1);
			assert.include(problem?.message, "pluginfinity://bogus");
			assert.lengthOf(rest, 0);
		}
	});

	it("fails a titled link glued to a built link by a slash, on both targets", () => {
		const body = 'See [a](pluginfinity://skill/alpha)/[b](pluginfinity://skill/nope "t")';
		for (const ctx of [claude, copilot]) {
			const found = problems(renderTokens(body, ctx));
			assert.isAtLeast(found.length, 1);
			assert.isTrue(found.some((p) => p.message.includes("pluginfinity://skill/nope")));
		}
	});

	it("leaves a stray pluginfinity:// in code alone", () => {
		const body = ["`<pluginfinity://agent/reviewer>`", "```", "[r]: PLUGINFINITY://skill/alpha", "```"].join("\n");
		assert.strictEqual(text(renderTokens(body, copilot)), body);
	});

	it("keeps a skill link's anchor in Claude's path and drops it from Copilot prose", () => {
		const file = "[s](pluginfinity://skill/alpha/references/guide.md#sec)";
		assert.strictEqual(text(renderTokens(file, claude)), `[s](${ROOT}/skills/alpha/references/guide.md#sec)`);
		assert.strictEqual(text(renderTokens(file, copilot)), "s (the `alpha` skill's `references/guide.md`)");
		const bare = "[s](pluginfinity://skill/beta#usage)";
		assert.strictEqual(text(renderTokens(bare, claude)), `[s](${ROOT}/skills/beta/SKILL.md#usage)`);
		assert.strictEqual(text(renderTokens(bare, copilot)), "s (the `beta` skill)");
	});

	it("validates only the path part of an anchored link", () => {
		const [problem] = problems(renderTokens("[s](pluginfinity://skill/alpha/nope.md#sec)", claude));
		assert.include(problem?.message, 'no file "nope.md"');
	});

	it("builds Claude's path from the target's skills directory", () => {
		const target = Target.make({ ...CLAUDE, skills: { ...CLAUDE.skills, dir: "kit/skills" } });
		assert.strictEqual(
			text(renderTokens("[b](pluginfinity://skill/beta)", tokenContext(target))),
			`[b](${ROOT}/kit/skills/beta/SKILL.md)`,
		);
	});
});

describe("renderTokens: problems", () => {
	it("reports every problem in a file with its line, in order", () => {
		const body = [
			"fine {{tool Read}}",
			"{{plugin_root}} and {{tool TodoWrite}}",
			"",
			"```",
			"{{agent ghost}}",
			"```",
			"[x](pluginfinity://skill/ghost)",
		].join("\n");
		assert.deepStrictEqual(
			problems(renderTokens(body, copilot)).map((p) => p.line),
			[2, 2, 5, 7],
		);
	});
});

describe("renderTokens: host blocks", () => {
	it("never evaluates a token in another target's host block", () => {
		const body = [
			"<!-- pluginfinity:only claude -->",
			"{{plugin_root}}",
			"<!-- /pluginfinity:only -->",
			"{{tool Read}}",
		].join("\n");
		const kept = applyHostBlocks(body, "copilot", ["claude", "copilot"]);
		if (!("text" in kept)) assert.fail("host blocks failed");
		assert.strictEqual(text(renderTokens(kept.text, copilot)), "view");
	});
});

describe("renderTokens: determinism", () => {
	it("renders the same input to the same bytes every time", () => {
		const body =
			"{{tool Read}} [g](pluginfinity://skill/alpha/references/guide.md) {{agent reviewer}}\n`{{skill beta}}`";
		for (const ctx of [claude, copilot]) {
			const first = text(renderTokens(body, ctx));
			assert.strictEqual(text(renderTokens(body, ctx)), first);
			assert.strictEqual(text(renderTokens(body, ctx)), first);
		}
	});
});
