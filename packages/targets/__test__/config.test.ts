import { assert, describe, it } from "@effect/vitest";
import { BASE_CONFIG_KEYS } from "@pluginfinity/core";
import { Effect, Schema } from "effect";
import { CONFIG_KEYS, KNOWN_TARGET_IDS, PluginfinityConfig, TARGETS, enabledTargets } from "../src/index.js";

const decode = (input: unknown) => Schema.decodeUnknownEffect(PluginfinityConfig)(input, { onExcessProperty: "error" });

describe("the target registry", () => {
	it("lists claude and copilot, in that order", () => {
		assert.deepStrictEqual(KNOWN_TARGET_IDS, ["claude", "copilot"]);
		assert.deepStrictEqual(
			TARGETS.map((target) => target.id),
			[...KNOWN_TARGET_IDS],
		);
	});

	// Base fields and target ids share one key space: a target named `name`
	// would make `name: true` ambiguous.
	it("never reuses a base config key as a target id", () => {
		const overlap = KNOWN_TARGET_IDS.filter((id) => BASE_CONFIG_KEYS.includes(id));
		assert.deepStrictEqual(overlap, []);
	});

	// Positive control: the overlap check above sees a collision when one exists.
	it("the overlap check flags a colliding id", () => {
		const overlap = ["name", ...KNOWN_TARGET_IDS].filter((id) => BASE_CONFIG_KEYS.includes(id));
		assert.deepStrictEqual(overlap, ["name"]);
	});
});

describe("PluginfinityConfig", () => {
	it("has exactly one key per base field and per registry target", () => {
		assert.deepStrictEqual(Object.keys(PluginfinityConfig.fields), [...CONFIG_KEYS]);
	});

	it.effect("decodes the spec's example config", () =>
		Effect.gen(function* () {
			const config = yield* decode({ name: "foo", claude: { name: "baz" }, copilot: true });
			assert.deepStrictEqual(config, { name: "foo", claude: { name: "baz" }, copilot: true });
			assert.deepStrictEqual(enabledTargets(config), ["claude", "copilot"]);
		}),
	);

	it.effect("an absent target key is off", () =>
		Effect.gen(function* () {
			const config = yield* decode({ name: "foo", copilot: true });
			assert.deepStrictEqual(enabledTargets(config), ["copilot"]);
		}),
	);

	it.effect("rejects a missing name", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode({ claude: true }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("rejects an unknown top-level key", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decode({ name: "foo", claud: true }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});
