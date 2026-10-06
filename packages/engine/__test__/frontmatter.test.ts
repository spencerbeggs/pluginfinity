import { assert, describe, it } from "@effect/vitest";
import { CLAUDE, COPILOT } from "@pluginfinity/targets";
import { appendSections, mapFrontmatter, splitFrontmatter } from "../src/frontmatter.js";

describe("splitFrontmatter", () => {
	it("splits at the closing fence and keeps the body unchanged", () => {
		assert.deepStrictEqual(splitFrontmatter("---\nname: a\n---\n\n# A\n"), { frontmatter: "name: a", body: "\n# A\n" });
	});

	it("is undefined when the file does not open with a fence", () => {
		assert.isUndefined(splitFrontmatter("# A\n---\nname: a\n---\n"));
	});
});

describe("mapFrontmatter", () => {
	const base = { name: "a", description: "Does a.", when_to_use: "doing a", license: "MIT" };

	it("claude keeps every field it has", () => {
		const mapped = mapFrontmatter(CLAUDE, CLAUDE.skills.fields, CLAUDE.skills.hostFields, base, {});
		assert.deepStrictEqual(mapped.fields, base);
	});

	it("copilot folds when_to_use into description as a suffix", () => {
		const mapped = mapFrontmatter(COPILOT, COPILOT.skills.fields, COPILOT.skills.hostFields, base, {});
		assert.strictEqual(mapped.fields.description, "Does a. Also use when: doing a");
		assert.isFalse("when_to_use" in mapped.fields);
	});

	it("a description in the target block replaces the base one, and nothing is folded into it", () => {
		const mapped = mapFrontmatter(COPILOT, COPILOT.skills.fields, COPILOT.skills.hostFields, base, {
			description: "Copilot's own.",
		});
		assert.strictEqual(mapped.fields.description, "Copilot's own.");
	});

	it("a field the target leaves unresolved is reported, not written", () => {
		const mapped = mapFrontmatter(
			COPILOT,
			COPILOT.skills.fields,
			COPILOT.skills.hostFields,
			{ ...base, compatibility: "node" },
			{},
		);
		assert.deepStrictEqual(
			mapped.unresolved.map((field) => field.field),
			["compatibility"],
		);
		assert.isFalse("compatibility" in mapped.fields);
	});

	it("claude keeps a tool string, rules included, exactly as written", () => {
		const mapped = mapFrontmatter(
			CLAUDE,
			CLAUDE.skills.fields,
			CLAUDE.skills.hostFields,
			{
				...base,
				"allowed-tools": "Bash(git log:*) Read, Grep",
			},
			{},
		);
		assert.strictEqual(mapped.fields["allowed-tools"], "Bash(git log:*) Read, Grep");
	});

	it("on a host that renames the tool, the string splits around a rule, which is unresolved rather than widened", () => {
		const mapped = mapFrontmatter(
			COPILOT,
			COPILOT.skills.fields,
			COPILOT.skills.hostFields,
			{
				...base,
				"allowed-tools": "Bash(git log:*) Read",
			},
			{},
		);
		assert.deepStrictEqual(mapped.fields["allowed-tools"], ["read"]);
		assert.deepStrictEqual(
			mapped.unresolved.map((field) => field.field),
			["allowed-tools: Bash(git log:*)"],
		);
	});

	it("a block field that is neither a core field nor a host field is reported as unknown", () => {
		const mapped = mapFrontmatter(COPILOT, COPILOT.skills.fields, COPILOT.skills.hostFields, base, { colour: "red" });
		assert.deepStrictEqual(mapped.unknown, ["colour"]);
	});

	it("an agent's renamed field and host field land under the target's names", () => {
		const mapped = mapFrontmatter(
			COPILOT,
			COPILOT.agents.fields,
			COPILOT.agents.hostFields,
			{ name: "a", description: "Does a.", effort: "high", skills: ["x", "y"] },
			{ handoffs: [{ label: "Next" }] },
		);
		assert.deepStrictEqual(mapped.fields, {
			name: "a",
			description: "Does a.",
			reasoningEffort: "high",
			handoffs: [{ label: "Next" }],
		});
		assert.deepStrictEqual(mapped.sections, [{ field: "skills", value: ["x", "y"] }]);
	});
});

describe("unlisted tools", () => {
	const tools = ["Read", "ToolSearch", "TaskCreate", "mcp__docs__search", "mcp__plugin_x_y__run"];

	it("copilot drops a Claude-only tool and another plugin's MCP tool", () => {
		const mapped = mapFrontmatter(
			COPILOT,
			COPILOT.agents.fields,
			COPILOT.agents.hostFields,
			{ name: "a", description: "x", tools },
			{},
		);
		assert.deepStrictEqual(mapped.fields.tools, ["read", "docs/search"]);
	});

	it("claude keeps every tool name", () => {
		const mapped = mapFrontmatter(
			CLAUDE,
			CLAUDE.agents.fields,
			CLAUDE.agents.hostFields,
			{ name: "a", description: "x", tools },
			{},
		);
		assert.deepStrictEqual(mapped.fields.tools, tools);
	});
});

describe("mapFrontmatter values on copilot", () => {
	const agent = (fields: Record<string, unknown>) =>
		mapFrontmatter(
			COPILOT,
			COPILOT.agents.fields,
			COPILOT.agents.hostFields,
			{ name: "a", description: "x", ...fields },
			{},
		);

	it("a Claude model alias or an effort Copilot lacks is unresolved, not shipped", () => {
		const mapped = agent({ model: "opus", effort: "max" });
		assert.deepStrictEqual(
			mapped.unresolved.map((field) => field.field),
			["model: opus", "effort: max"],
		);
		assert.deepStrictEqual(mapped.fields, { name: "a", description: "x" });
	});

	it("a full model ID passes through, and a shared effort is written as reasoningEffort", () => {
		assert.deepStrictEqual(agent({ model: "gpt-5", effort: "high" }).fields, {
			name: "a",
			description: "x",
			model: "gpt-5",
			reasoningEffort: "high",
		});
	});
});

describe("appendSections", () => {
	it("marks the list like the body's first bullet list", () => {
		assert.strictEqual(
			appendSections("+ one\n+ two\n", [{ field: "skills", value: ["x"] }]),
			"+ one\n+ two\n\n## Skills\n\n+ x\n",
		);
	});

	it("appends each section as a heading and a bullet list", () => {
		assert.strictEqual(
			appendSections("Body.\n", [{ field: "skills", value: ["x", "y"] }]),
			"Body.\n\n## Skills\n\n- x\n- y\n",
		);
	});
});

describe("mapFrontmatter drops", () => {
	const agent = { name: "x", description: "Does x.", color: "red", maxTurns: 3 };

	it("copilot reports each agent field it drops; claude, which keeps them, reports none", () => {
		const copilot = mapFrontmatter(COPILOT, COPILOT.agents.fields, COPILOT.agents.hostFields, agent, {});
		assert.deepStrictEqual(copilot.drops, [
			{ field: "color", kind: "dropped" },
			{ field: "maxTurns", kind: "dropped" },
		]);
		const claude = mapFrontmatter(CLAUDE, CLAUDE.agents.fields, CLAUDE.agents.hostFields, agent, {});
		assert.deepStrictEqual(claude.drops, []);
	});

	it("a skill's paths and an agent's skills are degraded on copilot", () => {
		const skill = mapFrontmatter(
			COPILOT,
			COPILOT.skills.fields,
			COPILOT.skills.hostFields,
			{ name: "s", description: "Does s.", paths: ["src/**"] },
			{},
		);
		assert.deepStrictEqual(skill.drops, [{ field: "paths", kind: "degraded" }]);
		const withSkills = mapFrontmatter(
			COPILOT,
			COPILOT.agents.fields,
			COPILOT.agents.hostFields,
			{ name: "x", description: "Does x.", skills: ["s"] },
			{},
		);
		assert.deepStrictEqual(withSkills.drops, [{ field: "skills", kind: "degraded" }]);
	});

	it("a tool copilot cannot name is tool-dropped, once; a rule-bearing renamed tool stays unresolved", () => {
		const mapped = mapFrontmatter(
			COPILOT,
			COPILOT.skills.fields,
			COPILOT.skills.hostFields,
			{ name: "s", description: "Does s.", "allowed-tools": "Read ToolSearch ToolSearch Bash(git log:*)" },
			{},
		);
		assert.deepStrictEqual(mapped.drops, [{ field: "ToolSearch", kind: "tool-dropped" }]);
		assert.deepStrictEqual(
			mapped.unresolved.map((field) => field.field),
			["allowed-tools: Bash(git log:*)"],
		);
	});

	it("a component that sets its own description degrades nothing into it, so reports no degraded field", () => {
		const mapped = mapFrontmatter(
			COPILOT,
			COPILOT.skills.fields,
			COPILOT.skills.hostFields,
			{ name: "s", description: "Does s.", when_to_use: "doing s", paths: ["src/**"] },
			{ description: "Copilot's own." },
		);
		assert.deepStrictEqual(mapped.drops, []);
	});

	it("claude reports nothing for a skill that sets nothing host-specific", () => {
		const mapped = mapFrontmatter(
			CLAUDE,
			CLAUDE.skills.fields,
			CLAUDE.skills.hostFields,
			{ name: "s", description: "Does s.", when_to_use: "doing s", "allowed-tools": "Read ToolSearch" },
			{},
		);
		assert.deepStrictEqual(mapped.drops, []);
	});
});
