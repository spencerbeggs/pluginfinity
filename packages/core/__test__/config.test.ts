import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { BASE_CONFIG_KEYS, BaseConfigFields, Hooks, PluginName, makeTargetSetting } from "../src/index.js";
import { decodeStrict } from "./utils/decode.js";

const decodeName = decodeStrict(PluginName);
const Base = Schema.Struct(BaseConfigFields);
const decodeBase = decodeStrict(Base);
const decodeSetting = decodeStrict(makeTargetSetting(Hooks));

describe("PluginName", () => {
	it.effect("accepts kebab-case names", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* decodeName("pluginfinity"), "pluginfinity");
			assert.strictEqual(yield* decodeName("my-plugin-2"), "my-plugin-2");
		}),
	);

	for (const bad of ["Foo", "my_plugin", "-lead", "trail-", "two--hyphens", ""]) {
		it.effect(`rejects ${JSON.stringify(bad)}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeName(bad));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}
});

describe("BaseConfigFields", () => {
	it.effect("accepts the full plugin-wide config", () =>
		Effect.gen(function* () {
			const config = {
				name: "dogfood",
				description: "End-to-end fixture",
				author: { name: "C. Spencer Beggs", email: "spencer@beggs.codes", url: "https://beg.gs" },
				homepage: "https://example.com",
				repository: "https://github.com/spencerbeggs/pluginfinity",
				license: "MIT",
				keywords: ["plugins"],
				scripts: { invoke: "exec" as const },
				hooks: { PreToolUse: [{ matcher: "Bash", script: "hooks/guard.sh" }] },
				mcpServers: { docs: { type: "http" as const, url: "https://example.com/mcp" } },
			} as const;
			assert.deepStrictEqual(yield* decodeBase(config), config);
		}),
	);

	it.effect("needs only name and description", () =>
		Effect.gen(function* () {
			const config = { name: "x", description: "y" };
			assert.deepStrictEqual(yield* decodeBase(config), config);
		}),
	);

	it.effect("accepts lspServers and shipped files", () =>
		Effect.gen(function* () {
			const config = {
				name: "x",
				description: "y",
				lspServers: { md: { command: "sh", extensionToLanguage: { ".md": "markdown" } } },
				files: ["bin/", "share/data.json", ".mcp.json", "buildsx/", "a/b/"],
			};
			assert.deepStrictEqual(yield* decodeBase(config), config);
		}),
	);

	const rejected: ReadonlyArray<readonly [string, unknown]> = [
		["an empty shipped path", { name: "x", description: "y", files: [""] }],
		["an absolute shipped path", { name: "x", description: "y", files: ["/abs"] }],
		["a shipped path with a .. segment", { name: "x", description: "y", files: ["../x"] }],
		["a shipped path with an inner .. segment", { name: "x", description: "y", files: ["a/../b"] }],
		["a shipped path that is ..", { name: "x", description: "y", files: [".."] }],
		["a shipped path with a leading . segment", { name: "x", description: "y", files: ["./x"] }],
		["a shipped path with an inner . segment", { name: "x", description: "y", files: ["a/./b"] }],
		["a shipped path with an empty segment", { name: "x", description: "y", files: ["a//b"] }],
		["a shipped path ending in an empty segment", { name: "x", description: "y", files: ["a//"] }],
		["a shipped path that is the bare root .", { name: "x", description: "y", files: ["."] }],
		["a shipped path that is the bare root ./", { name: "x", description: "y", files: ["./"] }],
		["a shipped path that is builds/", { name: "x", description: "y", files: ["builds/"] }],
		["a shipped path that is builds", { name: "x", description: "y", files: ["builds"] }],
		["a shipped path under builds/", { name: "x", description: "y", files: ["builds/claude/x"] }],
		["a shipped path that is node_modules/", { name: "x", description: "y", files: ["node_modules/"] }],
		["a shipped path under node_modules/", { name: "x", description: "y", files: ["node_modules/a/b.js"] }],
		["a missing description", { name: "x" }],
		["an empty description", { name: "x", description: "" }],
		["an unknown scripts.invoke", { name: "x", description: "y", scripts: { invoke: "sh" } }],
		["an author without a name", { name: "x", description: "y", author: { email: "a@b.c" } }],
		["a hook on an event Claude Code lacks", { name: "x", description: "y", hooks: { subagentStart: [] } }],
	];
	for (const [label, input] of rejected) {
		it.effect(`rejects ${label}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeBase(input));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}

	it("lists its keys", () => {
		assert.deepStrictEqual(BASE_CONFIG_KEYS, [
			"name",
			"description",
			"author",
			"homepage",
			"repository",
			"license",
			"keywords",
			"scripts",
			"hooks",
			"mcpServers",
			"lspServers",
			"files",
		]);
	});
});

describe("makeTargetSetting", () => {
	it.effect("accepts true and an override object with name, hooks and mcpServers", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* decodeSetting(true), true);
			const override = {
				name: "baz",
				hooks: { Stop: [] as const },
				mcpServers: { docs: { type: "http" as const, url: "https://example.com/mcp" } },
			} as const;
			assert.deepStrictEqual(yield* decodeSetting(override), override);
			assert.deepStrictEqual(yield* decodeSetting({}), {});
		}),
	);

	it.effect("accepts an lspServers override", () =>
		Effect.gen(function* () {
			const override = { lspServers: { md: { command: "sh", extensionToLanguage: { ".md": "markdown" } } } };
			assert.deepStrictEqual(yield* decodeSetting(override), override);
		}),
	);

	it.effect("rejects false: an absent key is how a target is turned off", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeSetting(false));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects an unknown override key", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeSetting({ nmae: "x" }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});
