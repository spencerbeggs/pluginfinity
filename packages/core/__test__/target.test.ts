import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { FieldMapEntry, Target, absent, degrade, drop, keep, rename, translate, unresolved } from "../src/index.js";
import { decodeStrict } from "./utils/decode.js";

const decodeEntry = decodeStrict(FieldMapEntry);
const decodeTarget = decodeStrict(Target);

const minimalTarget = {
	manifest: {
		path: "plugin.json",
		format: "agent-plugins-1.0" as const,
		schema: "https://example.com/s.json",
		keys: ["name"],
	},
	pluginRoot: { hooks: `\${PLUGIN_ROOT}`, mcp: `\${PLUGIN_ROOT}`, body: unresolved("no expansion in bodies") },
	skills: { dir: "skills", fields: { description: keep }, hostFields: [] },
	agents: { dir: "agents", suffix: ".agent.md", fields: { name: keep }, hostFields: ["handoffs"] },
	hooks: {
		path: "hooks.json",
		format: "copilot-hooks-v1" as const,
		events: { Stop: "Stop", Setup: absent },
		ownEvents: [],
	},
	mcp: { path: "mcp.json", format: "agent-plugins-mcp-1.0" as const },
	references: { style: "prose" as const },
	tools: { names: { Agent: "agent", Skill: unresolved("no alias") }, mcp: "{server}/{tool}" },
};

describe("FieldMapEntry", () => {
	it.effect("accepts every entry the constructors build", () =>
		Effect.gen(function* () {
			for (const entry of [
				keep,
				drop,
				rename("reasoningEffort"),
				translate("tools"),
				degrade("body-section"),
				unresolved("x"),
			]) {
				assert.deepStrictEqual(yield* decodeEntry(entry), entry);
			}
		}),
	);

	for (const [label, input] of [
		["an unknown tag", { _tag: "copy" }],
		["a rename without a target", { _tag: "rename" }],
		["an unknown degrade form", { _tag: "degrade", form: "footnote" }],
		["an unresolved without a note", { _tag: "unresolved" }],
	] as const) {
		it.effect(`rejects ${label}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeEntry(input));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}
});

describe("Target", () => {
	it.effect("accepts a complete description", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* decodeTarget(minimalTarget), minimalTarget);
		}),
	);

	it.effect("rejects an unknown manifest format", () =>
		Effect.gen(function* () {
			const bad = { ...minimalTarget, manifest: { ...minimalTarget.manifest, format: "yaml" as const } };
			const error = yield* Effect.flip(decodeTarget(bad));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects an unknown key", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeTarget({ ...minimalTarget, lsp: {} }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});
