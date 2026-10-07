import { assert, describe, it } from "@effect/vitest";
import { applyHostBlocks, inlineCodeSpans, mapHostBlocks } from "../src/body.js";

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

	it("strips markers indented to a list item's content column and keeps the item's own indentation", () => {
		const text = [
			"1. First.",
			"2. Second.",
			"   <!-- pluginfinity:only claude -->",
			"   Claude detail.",
			"   <!-- /pluginfinity:only -->",
			"   <!-- pluginfinity:only copilot -->",
			"   Copilot detail.",
			"   <!-- /pluginfinity:only -->",
			"3. Third.",
		].join("\n");
		assert.deepStrictEqual(applyHostBlocks(text, "claude", KNOWN), {
			text: ["1. First.", "2. Second.", "   Claude detail.", "3. Third."].join("\n"),
		});
		assert.deepStrictEqual(applyHostBlocks(text, "copilot", KNOWN), {
			text: ["1. First.", "2. Second.", "   Copilot detail.", "3. Third."].join("\n"),
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

	it("a marker inside fenced code is text, kept in place", () => {
		const text = [
			"Write a host block like this:",
			"",
			"```markdown",
			"<!-- pluginfinity:only claude -->",
			"Claude only.",
			"<!-- /pluginfinity:only -->",
			"```",
			"",
			"~~~~",
			"<!-- pluginfinity:only copilot -->",
			"~~~~",
		].join("\n");
		assert.deepStrictEqual(applyHostBlocks(text, "copilot", KNOWN), { text });
	});

	it("a marker in an inline code span is text, and a bare mention is not a marker", () => {
		const text = "Open one with `<!-- pluginfinity:only claude -->` and close it.\nThe pluginfinity:only name.";
		assert.deepStrictEqual(applyHostBlocks(text, "claude", KNOWN), { text });
	});

	it("a fence inside a dropped host block is dropped with it", () => {
		const text = [
			"<!-- pluginfinity:only claude -->",
			"```",
			"code",
			"```",
			"<!-- /pluginfinity:only -->",
			"End.",
		].join("\n");
		assert.deepStrictEqual(applyHostBlocks(text, "copilot", KNOWN), { text: "End." });
	});

	it("maps each kept line back to its source line", () => {
		assert.deepStrictEqual(mapHostBlocks(BODY, "claude", KNOWN), {
			text: ["Shared.", "Claude only.", "Both, listed.", "End."].join("\n"),
			lines: [1, 3, 6, 8],
		});
		assert.deepStrictEqual(mapHostBlocks(BODY, "copilot", KNOWN), {
			text: ["Shared.", "Both, listed.", "End."].join("\n"),
			lines: [1, 6, 8],
		});
		assert.deepStrictEqual(mapHostBlocks("a\nb", "claude", KNOWN), { text: "a\nb", lines: [1, 2] });
	});

	it("leaves a pluginfinity:// link for the token renderer to build", () => {
		const text = "Intro.\nSee [the guide](pluginfinity://skill/alpha/guide.md).";
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

describe("inlineCodeSpans", () => {
	it("finds single and double backtick spans", () => {
		assert.deepStrictEqual(inlineCodeSpans("a `b` c ``d`` e"), [
			{ start: 2, end: 5 },
			{ start: 8, end: 13 },
		]);
	});
	it("treats runs of another length inside a span as content", () => {
		assert.deepStrictEqual(inlineCodeSpans("``a ` b``"), [{ start: 0, end: 9 }]);
		assert.deepStrictEqual(inlineCodeSpans("`a `` b`"), [{ start: 0, end: 8 }]);
	});
	it("leaves an unclosed run literal and keeps scanning", () => {
		assert.deepStrictEqual(inlineCodeSpans("`` a `b`"), [{ start: 5, end: 8 }]);
		assert.deepStrictEqual(inlineCodeSpans("`a"), []);
	});
	it("finds adjacent spans", () => {
		assert.deepStrictEqual(inlineCodeSpans("`a`x`b`"), [
			{ start: 0, end: 3 },
			{ start: 4, end: 7 },
		]);
	});
	it("finds nothing in an empty string", () => {
		assert.deepStrictEqual(inlineCodeSpans(""), []);
	});
	it("scans a line of 100k backticks in linear time", () => {
		const line = "`".repeat(100_000);
		const t = performance.now();
		inlineCodeSpans(line);
		assert.isBelow(performance.now() - t, 200);
	});
	it("scans one backtick then runs of every length 1..k, which the old regex rescanned per run", () => {
		const k = 1000;
		let line = "`";
		for (let n = 2; n <= k; n++) line += `${"`".repeat(n)} `;
		const t = performance.now();
		inlineCodeSpans(line);
		assert.isBelow(performance.now() - t, 500);
	});
});

describe("host block scanning stays linear on pathological lines", () => {
	const within = (run: () => unknown): void => {
		const t = performance.now();
		run();
		assert.isBelow(performance.now() - t, 500);
	};
	it("rejects an opener with a very long whitespace run and no close", () => {
		const line = `<!-- pluginfinity:only${" ".repeat(200_000)}x`;
		within(() => {
			const result = applyHostBlocks(line, "claude", KNOWN);
			assert.deepStrictEqual(result, {
				problem: { line: 1, message: "a host block marker must be on a line of its own" },
			});
		});
	});
	it("rejects a marker line followed by runs of every backtick length", () => {
		let line = "see <!-- pluginfinity:only claude `";
		for (let n = 2; n <= 1000; n++) line += `${"`".repeat(n)} `;
		within(() => {
			assert.deepStrictEqual(mapHostBlocks(line, "claude", KNOWN), {
				problem: { line: 1, message: "a host block marker must be on a line of its own" },
			});
		});
	});
	it("still opens on a long id list with generous whitespace", () => {
		const open = `  <!--   pluginfinity:only${" ".repeat(50_000)}claude${"\t".repeat(50_000)}-->  `;
		const body = [open, "kept", "<!-- /pluginfinity:only -->"].join("\n");
		within(() => assert.deepStrictEqual(applyHostBlocks(body, "claude", KNOWN), { text: "kept" }));
	});
	it("treats an opener with no ids or a stray angle bracket as before", () => {
		assert.deepStrictEqual(
			applyHostBlocks("<!-- pluginfinity:only -->\nx\n<!-- /pluginfinity:only -->", "claude", KNOWN),
			{
				problem: { line: 1, message: "a host block names no target" },
			},
		);
		assert.deepStrictEqual(applyHostBlocks("<!-- pluginfinity:only a>b -->", "claude", KNOWN), {
			problem: { line: 1, message: "a host block marker must be on a line of its own" },
		});
	});
});
