import { assert, describe, layer } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, Layer, Path } from "effect";
import { ConfigDiscovery } from "../src/index.js";

// One seeded volume for every case: a repository at /repo with plugins in
// several shapes, and a stray config above the repository's .git boundary.
const Volume = Layer.merge(
	MemoryFileSystem.layerWith({
		"/pluginfinity.config.ts": "",
		"/repo/.git/HEAD": "ref: refs/heads/main\n",
		"/repo/plugins/a/pluginfinity.config.ts": "",
		"/repo/plugins/a/skills/deep/SKILL.md": "",
		"/repo/plugins/a/builds/claude/pluginfinity.config.ts": "",
		"/repo/plugins/b/pluginfinity.config.mjs": "",
		"/repo/plugins/two/pluginfinity.config.ts": "",
		"/repo/plugins/two/pluginfinity.config.js": "",
		"/repo/node_modules/dep/pluginfinity.config.ts": "",
		"/repo/docs/guide.md": "",
		"/single/pluginfinity.config.mts": "",
		"/single/sub/file.txt": "",
	}),
	Path.layer,
);

// A tree with no ambiguous directory, so `all` from its root reaches every
// prune decision instead of failing on the first ambiguous directory.
const PrunedTree = Layer.merge(
	MemoryFileSystem.layerWith({
		"/tree/.git/pluginfinity.config.ts": "",
		"/tree/node_modules/dep/pluginfinity.config.ts": "",
		"/tree/plugins/z/pluginfinity.config.ts": "",
		"/tree/plugins/z/builds/claude/pluginfinity.config.ts": "",
		"/tree/plugins/a/pluginfinity.config.mjs": "",
		"/tree/plugins/a/node_modules/dep/pluginfinity.config.js": "",
		"/tree/pluginfinity.config.mts": "",
	}),
	Path.layer,
);

describe("ConfigDiscovery.nearest", () => {
	layer(Volume)((it) => {
		it.effect("finds the config in the start directory", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* ConfigDiscovery.nearest("/repo/plugins/a"), "/repo/plugins/a/pluginfinity.config.ts");
			}),
		);

		it.effect("walks up to the nearest config", () =>
			Effect.gen(function* () {
				assert.strictEqual(
					yield* ConfigDiscovery.nearest("/repo/plugins/a/skills/deep"),
					"/repo/plugins/a/pluginfinity.config.ts",
				);
				assert.strictEqual(yield* ConfigDiscovery.nearest("/single/sub"), "/single/pluginfinity.config.mts");
			}),
		);

		it.effect("stops at the directory holding .git, never reaching a config above it", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(ConfigDiscovery.nearest("/repo/docs"));
				assert.strictEqual(error._tag, "ConfigNotFound");
				assert.strictEqual(error.path, "/repo/docs");
			}),
		);

		// Positive control for the boundary: with no .git on the way, the walk
		// does reach the root config the case above must not see.
		it.effect("without a .git boundary the walk reaches the filesystem root", () =>
			Effect.gen(function* () {
				assert.strictEqual(yield* ConfigDiscovery.nearest("/elsewhere/nested"), "/pluginfinity.config.ts");
			}),
		);

		it.effect("two configs in one directory is ConfigAmbiguous", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(ConfigDiscovery.nearest("/repo/plugins/two"));
				if (error._tag !== "ConfigAmbiguous") return assert.fail(`expected ConfigAmbiguous, got ${error._tag}`);
				assert.strictEqual(error.path, "/repo/plugins/two");
				assert.deepStrictEqual(error.files, ["pluginfinity.config.ts", "pluginfinity.config.js"]);
			}),
		);
	});
});

describe("ConfigDiscovery.all", () => {
	layer(Volume)((it) => {
		it.effect("finds every config below the start, skipping node_modules, builds and .git", () =>
			Effect.gen(function* () {
				const found = yield* ConfigDiscovery.all("/repo/plugins/a");
				assert.deepStrictEqual(found, ["/repo/plugins/a/pluginfinity.config.ts"]);
			}),
		);

		it.effect("an ambiguous directory anywhere below the start is ConfigAmbiguous", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(ConfigDiscovery.all("/repo"));
				assert.strictEqual(error._tag, "ConfigAmbiguous");
				assert.strictEqual(error.path, "/repo/plugins/two");
			}),
		);

		it.effect("lists configs in every extension", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* ConfigDiscovery.all("/repo/plugins/b"), [
					"/repo/plugins/b/pluginfinity.config.mjs",
				]);
				assert.deepStrictEqual(yield* ConfigDiscovery.all("/single"), ["/single/pluginfinity.config.mts"]);
			}),
		);

		it.effect("no config below the start is an empty list, not an error", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* ConfigDiscovery.all("/repo/docs"), []);
			}),
		);
	});
});

describe("ConfigDiscovery.all over an unambiguous tree", () => {
	layer(PrunedTree)((it) => {
		it.effect("skips configs under node_modules, builds and .git and lists the rest sorted", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* ConfigDiscovery.all("/tree"), [
					"/tree/pluginfinity.config.mts",
					"/tree/plugins/a/pluginfinity.config.mjs",
					"/tree/plugins/z/pluginfinity.config.ts",
				]);
			}),
		);
	});
});
