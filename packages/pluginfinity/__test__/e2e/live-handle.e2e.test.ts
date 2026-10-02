import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { CliTest } from "@effected/cli/testing";
import { Effect, FileSystem, Option } from "effect";
import { LEAVES_LIVE_HANDLE } from "./fixtures/configs.js";
import { BUILT_BIN } from "./utils/paths.js";

// jiti evaluates the config in-process, so a timer it starts would keep a
// successful run alive after its output unless the bin exits explicitly.
describe("a config that leaves a live handle", () => {
	// Live clock: under it.effect the TestClock would never fire the deadline.
	it.live(
		"pluginfinity doctor --agent still exits 0 promptly with the whole JSON report on stdout",
		() =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
				const root = yield* fs.realPath(sandbox.root);
				const config = join(root, "pluginfinity.config.mjs");
				yield* fs.writeFileString(config, LEAVES_LIVE_HANDLE);
				const result = yield* CliTest.run(BUILT_BIN, ["doctor", "--agent"], {
					sandbox,
					execPath: process.execPath,
					cwd: root,
				}).pipe(Effect.timeoutOption("8 seconds"));
				assert.isTrue(Option.isSome(result), "the bin did not exit within 8 seconds");
				if (Option.isNone(result)) return;
				assert.strictEqual(result.value.exitCode, 0, result.value.stderr);
				const report = JSON.parse(result.value.stdout);
				const check = report.checks.find((entry: { id: string }) => entry.id === "config");
				assert.deepStrictEqual([check.status, check.path], ["pass", config]);
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		20_000,
	);
});
