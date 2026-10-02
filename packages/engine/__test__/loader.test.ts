import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Path } from "effect";
import { ConfigLoader } from "../src/index.js";
import {
	FUNCTION_DEFAULT,
	INVALID_SHAPE,
	NESTED_UNKNOWN_KEY,
	NO_DEFAULT,
	NO_TARGET,
	NULL_DEFAULT,
	SHARED_MODULE,
	SYNTAX_ERROR,
	THROWS_ON_LOAD,
	UNKNOWN_KEY,
	UNRESOLVED_IMPORT,
	VALID,
	VALID_WITH_IMPORT,
} from "./fixtures/configs.js";
import { writeTree } from "./utils/tree.js";

// Real files on a real disk: jiti reads them itself, not through FileSystem.
const loadFrom = (files: Readonly<Record<string, string>>) =>
	Effect.gen(function* () {
		const path = yield* Path.Path;
		const root = yield* writeTree(files);
		const configPath = path.join(root, "pluginfinity.config.ts");
		return { root, configPath, result: yield* Effect.result(ConfigLoader.load(configPath)) };
	});

describe("ConfigLoader.load", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("loads a valid config: default export, decoded, plugin root and targets", () =>
			Effect.gen(function* () {
				const { root, configPath, result } = yield* loadFrom({ "pluginfinity.config.ts": VALID });
				assert.strictEqual(result._tag, "Success");
				if (result._tag !== "Success") return;
				assert.strictEqual(result.success.path, configPath);
				assert.strictEqual(result.success.root, root);
				assert.deepStrictEqual(result.success.config, {
					name: "valid-plugin",
					claude: { name: "valid-claude" },
					copilot: true,
				});
				assert.deepStrictEqual(result.success.targets, ["claude", "copilot"]);
			}),
		);

		it.effect("resolves a relative import next to the config", () =>
			Effect.gen(function* () {
				const { result } = yield* loadFrom({ "pluginfinity.config.ts": VALID_WITH_IMPORT, "shared.ts": SHARED_MODULE });
				assert.strictEqual(result._tag, "Success");
				if (result._tag !== "Success") return;
				assert.strictEqual(result.success.config.name, "shared-name");
			}),
		);

		it.effect("a syntax error is ConfigLoadFailed naming the file", () =>
			Effect.gen(function* () {
				const { configPath, result } = yield* loadFrom({ "pluginfinity.config.ts": SYNTAX_ERROR });
				assert.strictEqual(result._tag, "Failure");
				if (result._tag !== "Failure") return;
				assert.strictEqual(result.failure._tag, "ConfigLoadFailed");
				assert.strictEqual(result.failure.path, configPath);
			}),
		);

		it.effect("an unresolved import is ConfigLoadFailed carrying the import error", () =>
			Effect.gen(function* () {
				const { result } = yield* loadFrom({ "pluginfinity.config.ts": UNRESOLVED_IMPORT });
				assert.strictEqual(result._tag, "Failure");
				if (result._tag !== "Failure" || result.failure._tag !== "ConfigLoadFailed")
					return assert.fail("expected ConfigLoadFailed");
				assert.include(result.failure.detail, "does-not-exist");
			}),
		);

		it.effect("an invalid shape is ConfigInvalid listing every issue", () =>
			Effect.gen(function* () {
				const { result } = yield* loadFrom({ "pluginfinity.config.ts": INVALID_SHAPE });
				if (result._tag !== "Failure" || result.failure._tag !== "ConfigInvalid")
					return assert.fail("expected ConfigInvalid");
				assert.deepStrictEqual(
					result.failure.issues.map((issue) => issue.key),
					["name", "claude"],
				);
			}),
		);

		it.effect("an unknown key inside a target override is ConfigInvalid naming that key", () =>
			Effect.gen(function* () {
				const { result } = yield* loadFrom({ "pluginfinity.config.ts": NESTED_UNKNOWN_KEY });
				if (result._tag !== "Failure" || result.failure._tag !== "ConfigInvalid")
					return assert.fail("expected ConfigInvalid");
				const keys = result.failure.issues.map((issue) => issue.key);
				assert.isTrue(
					keys.some((key) => key.startsWith("claude")),
					`expected an issue under claude, got ${JSON.stringify(keys)}`,
				);
			}),
		);

		it.effect("an unknown top-level key is UnknownTarget listing the known targets", () =>
			Effect.gen(function* () {
				const { result } = yield* loadFrom({ "pluginfinity.config.ts": UNKNOWN_KEY });
				if (result._tag !== "Failure" || result.failure._tag !== "UnknownTarget")
					return assert.fail("expected UnknownTarget");
				assert.deepStrictEqual(result.failure.targets, ["claud"]);
				assert.deepStrictEqual(result.failure.known, ["claude", "copilot"]);
				assert.include(result.failure.message, "known targets: claude, copilot");
			}),
		);

		it.effect("a config with no target enabled is ConfigInvalid", () =>
			Effect.gen(function* () {
				const { result } = yield* loadFrom({ "pluginfinity.config.ts": NO_TARGET });
				if (result._tag !== "Failure" || result.failure._tag !== "ConfigInvalid")
					return assert.fail("expected ConfigInvalid");
				assert.include(result.failure.message, "no target is enabled");
			}),
		);

		it.effect("a config with no default export is ConfigInvalid", () =>
			Effect.gen(function* () {
				const { result } = yield* loadFrom({ "pluginfinity.config.ts": NO_DEFAULT });
				if (result._tag !== "Failure" || result.failure._tag !== "ConfigInvalid")
					return assert.fail("expected ConfigInvalid");
				assert.include(result.failure.message, "no default export");
			}),
		);

		it.effect("a config that throws while evaluating is ConfigLoadFailed, not a crash", () =>
			Effect.gen(function* () {
				const { result } = yield* loadFrom({ "pluginfinity.config.ts": THROWS_ON_LOAD });
				if (result._tag !== "Failure" || result.failure._tag !== "ConfigLoadFailed")
					return assert.fail("expected ConfigLoadFailed");
				assert.include(result.failure.detail, "config exploded");
			}),
		);

		for (const [label, body] of [
			["null", NULL_DEFAULT],
			["a function", FUNCTION_DEFAULT],
		] as const) {
			it.effect(`a default export that is ${label} is ConfigInvalid`, () =>
				Effect.gen(function* () {
					const { result } = yield* loadFrom({ "pluginfinity.config.ts": body });
					if (result._tag !== "Failure") return assert.fail("expected a failure");
					assert.strictEqual(result.failure._tag, "ConfigInvalid");
				}),
			);
		}
	});
});
