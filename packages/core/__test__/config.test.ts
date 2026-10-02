import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { BASE_CONFIG_KEYS, PluginName, TargetSetting } from "../src/index.js";

const decodeName = Schema.decodeUnknownEffect(PluginName);
const decodeSetting = Schema.decodeUnknownEffect(TargetSetting);

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

describe("TargetSetting", () => {
	it.effect("accepts true and an override object", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* decodeSetting(true), true);
			assert.deepStrictEqual(yield* decodeSetting({ name: "baz" }), { name: "baz" });
			assert.deepStrictEqual(yield* decodeSetting({}), {});
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
			const error = yield* Effect.flip(
				Schema.decodeUnknownEffect(TargetSetting)({ nmae: "x" }, { onExcessProperty: "error" }),
			);
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});

describe("BASE_CONFIG_KEYS", () => {
	it("lists the plugin-wide fields", () => {
		assert.deepStrictEqual(BASE_CONFIG_KEYS, ["name"]);
	});
});
