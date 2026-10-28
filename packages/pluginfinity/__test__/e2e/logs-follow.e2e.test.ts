import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { CliTest } from "@effected/cli/testing";
import { Effect, FileSystem, Option, Stream } from "effect";
import { BUILT_BIN } from "./utils/paths.js";

// Ctrl-C ends `logs --follow` as it ends `tail -f`: exit 0 after the lines
// already read, where any other interrupted command exits 130.
describe("pluginfinity logs --follow", () => {
	it.live(
		"prints the existing tail for an agent, then exits 0 on SIGINT",
		() =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
				const state = sandbox.env.XDG_STATE_HOME;
				if (state === undefined) return assert.fail("the sandbox sets no XDG_STATE_HOME");
				yield* fs.makeDirectory(`${state}/pluginfinity/p`, { recursive: true });
				yield* fs.writeFileString(
					`${state}/pluginfinity/p/error.log`,
					"2026-10-06T10:00:00Z [claude] hook/a.sh: hello\n",
				);
				// The SIGINT exit gets the old 8 s before the scope's SIGKILL, not the 2 s default.
				const child = yield* CliTest.spawn(BUILT_BIN, ["logs", "--agent", "--follow", "--plugin", "p"], {
					sandbox,
					execPath: process.execPath,
					forceKillAfter: "8 seconds",
				});
				const first = yield* Stream.runHead(child.stdout).pipe(Effect.timeoutOption("8 seconds"));
				const line = Option.flatten(first);
				assert.isTrue(Option.isSome(line), "the tail was not printed within 8 seconds");
				yield* child.kill("SIGINT");
				const result = yield* child.result;
				assert.strictEqual(result.signal, null, "the bin did not exit on its own after SIGINT");
				assert.strictEqual(result.exitCode, 0);
				assert.strictEqual(JSON.parse(Option.getOrElse(line, () => "")).message, "hello");
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		30_000,
	);
});
