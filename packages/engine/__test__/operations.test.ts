import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, Path } from "effect";
import { build, preparePlugins, validate } from "../src/index.js";
import { ONLY_COPILOT, SYNTAX_ERROR, VALID } from "./fixtures/configs.js";
import { writeTree } from "./utils/tree.js";

describe("preparePlugins", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("with no --target, runs every enabled target", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": VALID });
				const [prepared] = yield* preparePlugins({ selection: { _tag: "Nearest", start: root }, targets: [] });
				assert.deepStrictEqual(prepared?.targets, ["claude", "copilot"]);
			}),
		);

		it.effect("a requested target the config does not enable is TargetNotEnabled naming the file", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* writeTree({ "pluginfinity.config.ts": ONLY_COPILOT });
				const error = yield* Effect.flip(
					preparePlugins({ selection: { _tag: "Nearest", start: root }, targets: ["claude"] }),
				);
				assert.strictEqual(error._tag, "TargetNotEnabled");
				assert.strictEqual(error.path, path.join(root, "pluginfinity.config.ts"));
			}),
		);

		it.effect("--all with no config below the start is ConfigNotFound", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "README.md": "" });
				const error = yield* Effect.flip(preparePlugins({ selection: { _tag: "All", start: root }, targets: [] }));
				assert.strictEqual(error._tag, "ConfigNotFound");
			}),
		);

		it.effect("--all stops at the first config that fails, naming that file", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"plugins/a/pluginfinity.config.ts": VALID,
					"plugins/b/pluginfinity.config.ts": SYNTAX_ERROR,
				});
				const error = yield* Effect.flip(preparePlugins({ selection: { _tag: "All", start: root }, targets: [] }));
				assert.strictEqual(error._tag, "ConfigLoadFailed");
				assert.strictEqual(error.path, path.join(root, "plugins", "b", "pluginfinity.config.ts"));
			}),
		);

		it.effect("an explicit --config that does not exist is ConfigNotFound naming that file", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* writeTree({ "pluginfinity.config.ts": VALID });
				const missing = path.join(root, "other.config.ts");
				const error = yield* Effect.flip(preparePlugins({ selection: { _tag: "File", path: missing }, targets: [] }));
				assert.strictEqual(error._tag, "ConfigNotFound");
				assert.strictEqual(error.path, missing);
			}),
		);
	});
});

describe("build and validate", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("build runs the front half, then stops with NotImplemented", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": VALID });
				const error = yield* Effect.flip(
					build({ selection: { _tag: "Nearest", start: root }, targets: [], check: false }),
				);
				assert.strictEqual(error._tag, "NotImplemented");
			}),
		);

		it.effect("build reports a config error before NotImplemented", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": ONLY_COPILOT });
				const error = yield* Effect.flip(
					build({ selection: { _tag: "Nearest", start: root }, targets: ["claude"], check: false }),
				);
				assert.strictEqual(error._tag, "TargetNotEnabled");
			}),
		);

		it.effect("validate runs the front half, then stops with NotImplemented", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": VALID });
				const error = yield* Effect.flip(
					validate({ selection: { _tag: "Nearest", start: root }, targets: [], skipHosts: false }),
				);
				assert.strictEqual(error._tag, "NotImplemented");
			}),
		);
	});
});
