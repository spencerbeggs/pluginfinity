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
	inFile,
	inManifest,
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
	pluginRoot: {
		hooks: `\${PLUGIN_ROOT}`,
		mcp: `\${PLUGIN_ROOT}`,
		lsp: `\${PLUGIN_ROOT}`,
		body: unresolved("no expansion in bodies"),
	},
	skills: { dir: "skills", fields: { description: keep }, hostFields: [], invoke: "/{plugin}:{skill}" },
	agents: {
		dir: "agents",
		suffix: ".agent.md",
		fields: { name: keep },
		hostFields: ["handoffs"],
		id: "{plugin}:{agent}",
	},
	hooks: {
		path: "hooks.json",
		format: "copilot-hooks-v1" as const,
		events: { Stop: "Stop", Setup: absent },
		ownEvents: [],
		matcherIgnored: [],
		output: { context: [], system_message: [] },
	},
	mcp: { placement: inFile("mcp.json"), format: "agent-plugins-mcp-1.0" as const },
	lsp: { placement: inFile("lsp.json"), format: "copilot-lsp-json" as const, fields: { command: keep } },
	monitors: unresolved("no monitors"),
	references: { style: "prose" as const },
	tools: {
		names: { Agent: "agent", Skill: drop, Task: unresolved("no alias") },
		mcp: "{server}/{tool}",
		unlisted: "drop" as const,
		runtime: {
			names: { Read: "view", TodoWrite: unresolved("not measured") },
			mcp: "{server}-{tool}",
			unlisted: "unresolved" as const,
		},
	},
	models: { inherit: drop, sonnet: "claude-sonnet", opus: unresolved("no alias") },
	efforts: { max: unresolved("no max") },
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
				translate("efforts", "reasoningEffort"),
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

	it.effect("rejects a model mapped to anything but a name, drop or unresolved", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeTarget({ ...minimalTarget, models: { inherit: keep } }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("accepts an unresolved skill invocation", () =>
		Effect.gen(function* () {
			const input = { ...minimalTarget, skills: { ...minimalTarget.skills, invoke: unresolved("none") } };
			assert.deepStrictEqual(yield* decodeTarget(input), Target.make(input));
		}),
	);

	it.effect("rejects a run-time table with an unknown unlisted rule", () =>
		Effect.gen(function* () {
			const bad = {
				...minimalTarget,
				tools: { ...minimalTarget.tools, runtime: { ...minimalTarget.tools.runtime, unlisted: "drop" } },
			};
			const error = yield* Effect.flip(decodeTarget(bad));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects a description without run-time tool names", () =>
		Effect.gen(function* () {
			const { runtime: _runtime, ...tools } = minimalTarget.tools;
			const error = yield* Effect.flip(decodeTarget({ ...minimalTarget, tools }));
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

describe("server placement", () => {
	it.effect("decodes a manifest placement for MCP and LSP servers", () =>
		Effect.gen(function* () {
			const decoded = yield* decodeTarget({
				...minimalTarget,
				mcp: {
					placement: { _tag: "manifest", key: "mcpServers", reserves: ".mcp.json" },
					format: "claude-mcp-servers",
				},
				lsp: {
					placement: { _tag: "manifest", key: "lspServers", reserves: ".lsp.json" },
					format: "claude-lsp-servers",
					fields: {},
				},
			});
			assert.deepStrictEqual(decoded.mcp.placement, inManifest("mcpServers", ".mcp.json"));
			assert.deepStrictEqual(decoded.lsp.placement, inManifest("lspServers", ".lsp.json"));
		}),
	);

	it.effect("decodes a file placement", () =>
		Effect.gen(function* () {
			const decoded = yield* decodeTarget(minimalTarget);
			assert.deepStrictEqual(decoded.mcp.placement, inFile("mcp.json"));
		}),
	);

	for (const [label, placement] of [
		["an empty path", { _tag: "file", path: "" }],
		["an empty manifest key", { _tag: "manifest", key: "", reserves: ".mcp.json" }],
		["a manifest placement with no reserved file", { _tag: "manifest", key: "mcpServers" }],
		["an empty reserved file", { _tag: "manifest", key: "mcpServers", reserves: "" }],
		["an unknown placement", { _tag: "inline", key: "mcpServers" }],
		["a bare path string", "mcp.json"],
	] as const) {
		it.effect(`rejects ${label}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeTarget({ ...minimalTarget, mcp: { ...minimalTarget.mcp, placement } }));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}

	it.effect("rejects the old path field", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				decodeTarget({ ...minimalTarget, mcp: { path: "mcp.json", format: "agent-plugins-mcp-1.0" } }),
			);
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
