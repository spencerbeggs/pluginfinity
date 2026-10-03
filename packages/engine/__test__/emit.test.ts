import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { Effect, FileSystem, Option, Path } from "effect";
import type { EmittedFile } from "../src/emit.js";
import { GENERATED_MODE, applyEmit, planEmit } from "../src/emit.js";
import { writeTree } from "./utils/tree.js";

const FILES: ReadonlyArray<EmittedFile> = [
	{ path: "plugin.json", content: "{}\n" },
	{ path: "skills/a/SKILL.md", content: "# A\n" },
];

/** Plan and apply in one step, returning the plan that was applied. */
const emit = (dir: string, files: ReadonlyArray<EmittedFile>) =>
	Effect.gen(function* () {
		const plan = yield* planEmit(dir, files);
		yield* applyEmit(dir, files, plan);
		return plan;
	});

const PAST = new Date("2000-01-01T00:00:00Z");

/** Backdate `file`, so a later rewrite shows as a newer mtime without waiting. */
const backdate = (file: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.utimes(file, PAST, PAST);
	});

const mtime = (file: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		return Option.getOrThrow((yield* fs.stat(file)).mtime).getTime();
	});

describe("planEmit and applyEmit", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("into a missing directory, every file is added and written with the generated mode", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const out = path.join(yield* writeTree({}), "builds", "claude");
				const plan = yield* emit(out, FILES);
				assert.deepStrictEqual(plan.added, ["plugin.json", "skills/a/SKILL.md"]);
				assert.strictEqual(yield* fs.readFileString(path.join(out, "skills/a/SKILL.md")), "# A\n");
				assert.strictEqual((yield* fs.stat(path.join(out, "plugin.json"))).mode & 0o777, GENERATED_MODE);
			}),
		);

		it.effect("a second run is clean and leaves every mtime alone", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const out = path.join(yield* writeTree({}), "builds", "claude");
				yield* emit(out, FILES);
				yield* backdate(path.join(out, "plugin.json"));
				const plan = yield* emit(out, FILES);
				assert.isTrue(plan.clean);
				assert.deepStrictEqual(plan.unchanged, ["plugin.json", "skills/a/SKILL.md"]);
				assert.strictEqual(yield* mtime(path.join(out, "plugin.json")), PAST.getTime());
			}),
		);

		it.effect("only the file whose bytes differ is rewritten", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const out = path.join(yield* writeTree({}), "builds", "claude");
				yield* emit(out, FILES);
				yield* backdate(path.join(out, "skills/a/SKILL.md"));
				const plan = yield* emit(out, [{ path: "plugin.json", content: '{"v":2}\n' }, FILES[1] as EmittedFile]);
				assert.deepStrictEqual(plan.changed, ["plugin.json"]);
				assert.strictEqual(yield* fs.readFileString(path.join(out, "plugin.json")), '{"v":2}\n');
				assert.strictEqual(yield* mtime(path.join(out, "skills/a/SKILL.md")), PAST.getTime());
			}),
		);

		it.effect("a file with the right bytes but the wrong mode is changed back to the generated mode", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const out = path.join(yield* writeTree({}), "builds", "claude");
				yield* emit(out, FILES);
				yield* fs.chmod(path.join(out, "plugin.json"), 0o755);
				const plan = yield* emit(out, FILES);
				assert.deepStrictEqual(plan.changed, ["plugin.json"]);
				assert.strictEqual((yield* fs.stat(path.join(out, "plugin.json"))).mode & 0o777, GENERATED_MODE);
			}),
		);

		it.effect("a file no longer produced is removed, and the directories it leaves empty are pruned", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const out = path.join(yield* writeTree({}), "builds", "claude");
				yield* emit(out, FILES);
				const plan = yield* emit(out, [FILES[0] as EmittedFile]);
				assert.deepStrictEqual(plan.removed, ["skills/a/SKILL.md"]);
				assert.isFalse(yield* fs.exists(path.join(out, "skills")));
				assert.isTrue(yield* fs.exists(path.join(out, "plugin.json")));
			}),
		);

		it.effect("a stray empty directory is planned as removed and removed", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const out = path.join(yield* writeTree({}), "builds", "claude");
				yield* emit(out, FILES);
				yield* fs.makeDirectory(path.join(out, "stray", "deeper"), { recursive: true });
				const plan = yield* emit(out, FILES);
				assert.deepStrictEqual(plan.removed, ["stray/deeper/"]);
				assert.isFalse(yield* fs.exists(path.join(out, "stray")));
			}),
		);

		it.effect("planning writes nothing, and applying leaves no staging directory behind", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const builds = path.join(yield* writeTree({}), "builds");
				const out = path.join(builds, "claude");
				yield* planEmit(out, FILES);
				assert.isFalse(yield* fs.exists(builds));
				yield* emit(out, FILES);
				assert.deepStrictEqual(yield* fs.readDirectory(builds), ["claude"]);
			}),
		);
	});
});
