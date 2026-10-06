import { assert, describe, it } from "@effect/vitest";
import { CLAUDE, COPILOT, PluginfinityConfig } from "@pluginfinity/targets";
import { Schema } from "effect";
import { renderMonitors, targetMonitors } from "../src/monitors.js";

describe("renderMonitors", () => {
	it("Claude renders script and command monitors with the root spelled and the name exported", () => {
		const out = renderMonitors(
			CLAUDE,
			{
				"dogfood-mail": { script: "monitors/mail.sh", args: ["--quiet"], description: "Mail." },
				issues: {
					command: `node "\${PLUGIN_ROOT}/monitors/issues.mjs"`,
					description: "Issues.",
					when: "on-skill-invoke:tsdoc",
				},
			},
			"bash",
		);
		assert.deepStrictEqual(JSON.parse(out.file?.content ?? "[]"), [
			{
				name: "dogfood-mail",
				command: `PLUGINFINITY_MONITOR='dogfood-mail' bash "\${CLAUDE_PLUGIN_ROOT}/monitors/mail.sh" --quiet`,
				description: "Mail.",
			},
			{
				name: "issues",
				command: `export PLUGINFINITY_MONITOR='issues'; node "\${CLAUDE_PLUGIN_ROOT}/monitors/issues.mjs"`,
				description: "Issues.",
				when: "on-skill-invoke:tsdoc",
			},
		]);
		assert.strictEqual(out.file?.path, "monitors/monitors.json");
		assert.deepStrictEqual(out.scripts, ["monitors/mail.sh"]);
		assert.deepStrictEqual(out.commandFiles, ["monitors/issues.mjs"]);
		assert.deepStrictEqual(out.notes, []);
	});

	it("under exec invoke a script entry drops bash", () => {
		const out = renderMonitors(CLAUDE, { a: { script: "monitors/a.sh", description: "A." } }, "exec");
		assert.deepStrictEqual(JSON.parse(out.file?.content ?? "[]"), [
			{ name: "a", command: `PLUGINFINITY_MONITOR='a' "\${CLAUDE_PLUGIN_ROOT}/monitors/a.sh"`, description: "A." },
		]);
	});

	it("with no monitors Claude writes no file", () => {
		const out = renderMonitors(CLAUDE, {}, "bash");
		assert.strictEqual(out.file, undefined);
		assert.deepStrictEqual(out.notes, []);
	});

	it("Copilot drops every monitor with a note and ships nothing", () => {
		const out = renderMonitors(COPILOT, { a: { script: "monitors/a.sh", description: "A." } }, "bash");
		assert.strictEqual(out.file, undefined);
		assert.deepStrictEqual(
			out.notes.map((n) => [n.kind, n.name, n.path, n.target]),
			[["monitor-omitted", "a", "config", "copilot"]],
		);
		assert.deepStrictEqual(out.scripts, []);
		assert.deepStrictEqual(out.commandFiles, []);
	});
});

describe("targetMonitors", () => {
	it("a target's monitor replaces the base monitor of its name and leaves the rest", () => {
		const config = Schema.decodeUnknownSync(PluginfinityConfig)({
			name: "m",
			description: "Fixture.",
			monitors: {
				a: { script: "monitors/a.sh", description: "A." },
				b: { script: "monitors/b.sh", description: "B." },
			},
			claude: { monitors: { a: { command: "true", description: "A for Claude." } } },
			copilot: true,
		});
		assert.deepStrictEqual(targetMonitors("claude", config), {
			a: { command: "true", description: "A for Claude." },
			b: { script: "monitors/b.sh", description: "B." },
		});
		assert.deepStrictEqual(Object.keys(targetMonitors("copilot", config)), ["a", "b"]);
	});
});
