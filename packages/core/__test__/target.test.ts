import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import {
	FieldMapEntry,
	Keep,
	Rename,
	Target,
	absent,
	degrade,
	drop,
	keep,
	rename,
	translate,
	unresolved,
} from "../src/index.js";
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
	tools: { names: { Agent: "agent", Skill: drop, Task: unresolved("no alias") }, mcp: "{server}/{tool}" },
	models: { inherit: drop, sonnet: "claude-sonnet" },
};

describe("FieldMapEntry", () => {
	it.effect("accepts every entry the constructors build", () =>
		Effect.gen(function* () {
			for (const entry of [
				keep,
				drop,
				rename("reasoningEffort"),
				translate("tools"),
				translate("models"),
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
		["a translate through an unknown table", { _tag: "translate", table: "colours" }],
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
			assert.deepStrictEqual(yield* decodeTarget(minimalTarget), Target.make(minimalTarget));
		}),
	);

	it.effect("rejects an unknown manifest format", () =>
		Effect.gen(function* () {
			const bad = { ...minimalTarget, manifest: { ...minimalTarget.manifest, format: "yaml" as const } };
			const error = yield* Effect.flip(decodeTarget(bad));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects a model mapped to anything but a name or drop", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeTarget({ ...minimalTarget, models: { inherit: unresolved("x") } }));
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

describe("Target as a class", () => {
	it.effect("decodes to a Target instance whose entries are class instances", () =>
		Effect.gen(function* () {
			const decoded = yield* decodeTarget(minimalTarget);
			assert.instanceOf(decoded, Target);
			assert.deepStrictEqual(decoded, Target.make(minimalTarget));
			assert.isTrue(Schema.is(Keep)(decoded.skills.fields.description));
		}),
	);

	it("Target.make rejects an invalid description at construction", () => {
		assert.throws(() =>
			Target.make({ ...minimalTarget, manifest: { ...minimalTarget.manifest, format: "yaml" } } as never),
		);
	});

	it("constructors return their own member type", () => {
		const entry: Rename = rename("reasoningEffort");
		assert.strictEqual(entry.to, "reasoningEffort");
		assert.isTrue(Schema.is(Keep)(keep));
		assert.isFalse(Schema.is(Rename)(keep));
	});
});
