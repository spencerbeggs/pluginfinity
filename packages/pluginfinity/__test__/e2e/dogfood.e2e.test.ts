import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { CliTest } from "@effected/cli/testing";
import { Effect } from "effect";
import { BUILT_BIN, DOGFOOD } from "./utils/paths.js";

// The built carrier bin, run the way a user runs it: inside the dogfood
// plugin, which loads its real pluginfinity.config.ts through `import "pluginfinity"`.
// The host tools are whatever this machine has; doctor without --strict
// exits 0 either way, so only the config check is asserted.
describe("dogfood smoke", () => {
	it.effect("pluginfinity doctor --agent in plugins/dogfood loads its config and exits 0", () =>
		Effect.gen(function* () {
			const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
			const result = yield* CliTest.run(BUILT_BIN, ["doctor", "--agent"], {
				sandbox,
				execPath: process.execPath,
				cwd: DOGFOOD,
			});
			assert.strictEqual(result.exitCode, 0, result.stderr);
			const report = JSON.parse(result.stdout);
			const config = report.checks.find((check: { id: string }) => check.id === "config");
			assert.deepStrictEqual([config.status, config.path], ["pass", resolve(DOGFOOD, "pluginfinity.config.ts")]);
			assert.strictEqual(report.distribution?.name, "pluginfinity");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});
