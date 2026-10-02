import { assert, describe, it } from "@effect/vitest";
import { CurrentDistribution } from "@effected/engine";
import { Effect, Option } from "effect";
import { runCli } from "./utils/run.js";

describe("pluginfinity", () => {
	it.effect("--version on a direct run prints the version with no distribution suffix and exits 0", () =>
		Effect.gen(function* () {
			const result = yield* runCli(["--version"]);
			assert.strictEqual(result.code, 0);
			assert.deepStrictEqual(result.stdout, ["pluginfinity v1.2.3"]);
			assert.deepStrictEqual(result.stderr, []);
		}),
	);

	it.effect("--version launched through a carrier names the distribution", () =>
		Effect.gen(function* () {
			const result = yield* runCli(["--version"]).pipe(
				Effect.provideService(CurrentDistribution, Option.some({ name: "pluginfinity", version: "0.4.0" })),
			);
			assert.strictEqual(result.code, 0);
			assert.deepStrictEqual(result.stdout, ["pluginfinity v1.2.3 via pluginfinity 0.4.0"]);
			assert.deepStrictEqual(result.stderr, []);
		}),
	);

	// Control: the harness can see a failing run, so the green above is real.
	it.effect("an unknown flag is a usage error that exits 64", () =>
		Effect.gen(function* () {
			const result = yield* runCli(["--no-such-flag"]);
			assert.strictEqual(result.code, 64);
		}),
	);

	it.effect("--help lists every command", () =>
		Effect.gen(function* () {
			const result = yield* runCli(["--help"]);
			assert.strictEqual(result.code, 0);
			const help = result.stdout.join("\n");
			for (const command of ["init", "plugin", "build", "validate", "doctor"]) assert.include(help, command);
		}),
	);

	it.effect("an agent-audience usage error leaves stdout empty, puts help on stderr and exits 64", () =>
		Effect.gen(function* () {
			const result = yield* runCli(["build", "--target", "vscode", "--agent"]);
			assert.strictEqual(result.code, 64);
			assert.deepStrictEqual(result.stdout, []);
			assert.isNotEmpty(result.stderr);
		}),
	);

	it.effect("an explicit --help under --agent still prints help on stdout", () =>
		Effect.gen(function* () {
			const result = yield* runCli(["build", "--help", "--agent"]);
			assert.strictEqual(result.code, 0);
			assert.include(result.stdout.join("\n"), "--target");
		}),
	);
});
