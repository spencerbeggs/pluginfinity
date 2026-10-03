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
