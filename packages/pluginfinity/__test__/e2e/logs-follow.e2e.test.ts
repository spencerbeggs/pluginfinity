import { spawn } from "node:child_process";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Deferred, Effect, FileSystem, Option } from "effect";
import { BUILT_BIN } from "./utils/paths.js";

// Ctrl-C ends `logs --follow` as it ends `tail -f`: exit 0 after the lines
// already read, where any other interrupted command exits 130.
describe("pluginfinity logs --follow", () => {
	it.live(
		"prints the existing tail for an agent, then exits 0 on SIGINT",
		() =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const state = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "pluginfinity-logs-" }));
				yield* fs.makeDirectory(`${state}/pluginfinity/p`, { recursive: true });
				yield* fs.writeFileString(
					`${state}/pluginfinity/p/error.log`,
					"2026-10-06T10:00:00Z [claude] hook/a.sh: hello\n",
				);
				const child = spawn(process.execPath, [BUILT_BIN, "logs", "--agent", "--follow", "--plugin", "p"], {
					cwd: state,
					env: { ...process.env, XDG_STATE_HOME: state },
					stdio: ["ignore", "pipe", "pipe"],
				});
				const printed = yield* Deferred.make<void>();
				const exited = yield* Deferred.make<number | null>();
				let stdout = "";
				child.stdout.on("data", (chunk: Buffer) => {
					stdout += chunk.toString();
					if (stdout.includes("hello")) Deferred.doneUnsafe(printed, Effect.void);
				});
				child.on("exit", (code) => Deferred.doneUnsafe(exited, Effect.succeed(code)));
				const seen = yield* Deferred.await(printed).pipe(Effect.timeoutOption("8 seconds"));
				assert.isTrue(Option.isSome(seen), "the tail was not printed within 8 seconds");
				child.kill("SIGINT");
				const code = yield* Deferred.await(exited).pipe(Effect.timeoutOption("8 seconds"));
				if (Option.isNone(code)) child.kill("SIGKILL");
				assert.isTrue(Option.isSome(code), "the bin did not exit after SIGINT");
				assert.deepStrictEqual(Option.getOrNull(code), 0);
				assert.strictEqual(JSON.parse(stdout.trim().split("\n")[0] ?? "").message, "hello");
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		30_000,
	);
});
