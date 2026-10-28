import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { CliTest } from "@effected/cli/testing";
import { Effect, FileSystem } from "effect";
import { BUILT_BIN } from "./utils/paths.js";

const LINE = "2026-10-06T10:00:00Z [claude] hook/a.sh: hello\n";

// The built bin reads logs where log.sh writes them:
// ${XDG_STATE_HOME:-${HOME:-/nonexistent}/.local/state}.
describe("pluginfinity logs state directory", () => {
	it.live(
		"a relative XDG_STATE_HOME is read from the working directory, as log.sh writes it",
		() =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
				yield* fs.makeDirectory(`${sandbox.root}/rel-state/pluginfinity/p`, { recursive: true });
				yield* fs.writeFileString(`${sandbox.root}/rel-state/pluginfinity/p/error.log`, LINE);
				const result = yield* CliTest.run(BUILT_BIN, ["logs", "--agent", "--plugin", "p"], {
					sandbox,
					execPath: process.execPath,
					env: { XDG_STATE_HOME: "rel-state" },
				});
				assert.strictEqual(result.exitCode, 0, result.stderr);
				assert.include(result.stdout, '"hello"');
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		30_000,
	);

	it.live(
		"an empty XDG_STATE_HOME counts as unset: the directory is under HOME",
		() =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const sandbox = yield* CliTest.sandbox({ path: process.env.PATH ?? "" });
				yield* fs.makeDirectory(`${sandbox.home}/.local/state/pluginfinity/p`, { recursive: true });
				yield* fs.writeFileString(`${sandbox.home}/.local/state/pluginfinity/p/error.log`, LINE);
				const result = yield* CliTest.run(BUILT_BIN, ["logs", "--agent", "--plugin", "p"], {
					sandbox,
					execPath: process.execPath,
					env: { XDG_STATE_HOME: "" },
				});
				assert.strictEqual(result.exitCode, 0, result.stderr);
				assert.include(result.stdout, '"hello"');
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		30_000,
	);
});
