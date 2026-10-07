import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { BaseConfigFields, EnvConfig } from "../src/index.js";
import { decodeStrict } from "./utils/decode.js";

const decodeEnv = decodeStrict(EnvConfig);
const decodeBase = decodeStrict(Schema.Struct(BaseConfigFields));

describe("EnvConfig", () => {
	it.effect("accepts a prefix, vars and a setup script", () =>
		Effect.gen(function* () {
			const env = {
				prefix: "SILK",
				vars: {
					SILK_PACKAGE_MANAGER: { default: "npm", description: "Package manager" },
					SILK_SKIP_CHANGESET_NUDGE: {},
				},
				setup: "scripts/env-setup.sh",
			};
			assert.deepStrictEqual(yield* decodeEnv(env), env);
		}),
	);

	it.effect("needs only vars, and admits names with no prefix set", () =>
		Effect.gen(function* () {
			const env = { vars: { _X: {}, A1: { default: "" }, TABBED: { default: "a\tb = 'c'" } } };
			assert.deepStrictEqual(yield* decodeEnv(env), env);
		}),
	);

	it.effect("is a plugin-wide config field", () =>
		Effect.gen(function* () {
			const config = { name: "x", description: "y", env: { vars: { X: {} } } };
			assert.deepStrictEqual(yield* decodeBase(config), config);
		}),
	);

	const rejected: ReadonlyArray<readonly [string, unknown]> = [
		["a lower-case name", { vars: { lower: {} } }],
		["a name starting with a digit", { vars: { "1X": {} } }],
		["a name with a hyphen", { vars: { "A-B": {} } }],
		["an empty name", { vars: { "": {} } }],
		["a name outside the prefix", { prefix: "SILK", vars: { SILK_A: {}, OTHER: {} } }],
		["the bare prefix as a name", { prefix: "SILK", vars: { SILK: {} } }],
		["a lower-case prefix", { prefix: "silk", vars: { silk_A: {} } }],
		["a reserved PLUGINFINITY_ name", { vars: { PLUGINFINITY_X: {} } }],
		["a reserved _PF_ name", { vars: { _PF_X: {} } }],
		["PATH", { vars: { PATH: {} } }],
		["IFS", { vars: { IFS: {} } }],
		["a non-string default", { vars: { X: { default: 1 } } }],
		["a default with a newline", { vars: { X: { default: "a\nb" } } }],
		["a default with a carriage return", { vars: { X: { default: "a\rb" } } }],
		["a default with a NUL", { vars: { X: { default: "a\u0000b" } } }],
		["a default with DEL", { vars: { X: { default: "a\u007fb" } } }],
		["an unknown var key", { vars: { X: { value: "a" } } }],
		["an absolute setup", { vars: { X: {} }, setup: "/abs.sh" }],
		["a setup outside the plugin", { vars: { X: {} }, setup: "../x.sh" }],
		["missing vars", { prefix: "X" }],
		["an unknown key", { vars: { X: {} }, timeout: 5 }],
	];
	for (const [name, input] of rejected) {
		it.effect(`rejects ${name}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeEnv(input));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}

	it.effect("names every var outside the prefix", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeEnv({ prefix: "SILK", vars: { A: {}, SILK_B: {}, C: {} } }));
			assert.include(error.message, '"SILK_"');
			assert.include(error.message, '["A"]');
			assert.include(error.message, '["C"]');
			assert.notInclude(error.message, '["SILK_B"]');
		}),
	);
});
