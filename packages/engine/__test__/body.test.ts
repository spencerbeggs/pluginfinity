import { assert, describe, it } from "@effect/vitest";
import { applyHostBlocks } from "../src/body.js";

const KNOWN = ["claude", "copilot"];

const BODY = [
	"Shared.",
	"<!-- pluginfinity:only claude -->",
	"Claude only.",
	"<!-- /pluginfinity:only -->",
	"<!-- pluginfinity:only copilot claude -->",
	"Both, listed.",
	"<!-- /pluginfinity:only -->",
	"End.",
].join("\n");

describe("applyHostBlocks", () => {
	it("keeps a block's passage for a listed target and removes every marker line", () => {
		assert.deepStrictEqual(applyHostBlocks(BODY, "claude", KNOWN), {
			text: ["Shared.", "Claude only.", "Both, listed.", "End."].join("\n"),
		});
	});

	it("drops a block's passage for an unlisted target", () => {
		assert.deepStrictEqual(applyHostBlocks(BODY, "copilot", KNOWN), {
			text: ["Shared.", "Both, listed.", "End."].join("\n"),
		});
	});

	it("leaves a body without markers byte for byte", () => {
		const text = "# Title\r\n\r\nNo blocks here.\n";
		assert.deepStrictEqual(applyHostBlocks(text, "claude", KNOWN), { text });
	});

	const problems: ReadonlyArray<readonly [string, string, number, string]> = [
		[
			"an unknown id",
			"<!-- pluginfinity:only vscode -->\nx\n<!-- /pluginfinity:only -->",
			1,
			`unknown target "vscode"`,
		],
		["a block that never closes", "a\n<!-- pluginfinity:only claude -->\nx", 2, "never closed"],
		["a close with no open", "a\n<!-- /pluginfinity:only -->", 2, "closes without opening"],
		[
			"a nested block",
			"<!-- pluginfinity:only claude -->\n<!-- pluginfinity:only copilot -->\n<!-- /pluginfinity:only -->",
			2,
			"do not nest",
		],
		["a marker inside other text", "text <!-- pluginfinity:only claude --> more", 1, "line of its own"],
		["a block naming no target", "<!-- pluginfinity:only  -->", 1, "names no target"],
	];
	for (const [label, text, line, message] of problems) {
		it(`${label} is a problem on its line`, () => {
			const result = applyHostBlocks(text, "claude", KNOWN);
			assert.isTrue("problem" in result);
			if (!("problem" in result)) return;
			assert.strictEqual(result.problem.line, line);
			assert.include(result.problem.message, message);
		});
	}
});
