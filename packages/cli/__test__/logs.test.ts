import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer, it as plainIt } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem, Path } from "effect";
import { TestConsole } from "effect/testing";
import { BOTH_TARGETS, RENAMED_TARGET, STATE_TREE } from "./fixtures/configs.js";
import { runCli } from "./utils/run.js";
import { writeTree } from "./utils/tree.js";

const tree = (extra: Readonly<Record<string, string>> = {}) =>
	writeTree({ ...STATE_TREE, "plugin/pluginfinity.config.ts": BOTH_TARGETS, ...extra });

describe("pluginfinity logs", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("inside a plugin: shows that plugin's error.log under a header, with the log directory", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--human"], { cwd: `${root}/plugin`, stateHome: `${root}/state` });
				assert.strictEqual(result.code, 0);
				assert.deepStrictEqual(result.stdout, [
					`Logs in ${root}/state/pluginfinity`,
					"==> both-targets/error.log <==",
					"2026-10-06T10:00:00Z [claude] hook/guard.sh: first",
					"not a log line",
					"2026-10-06T10:00:02Z [copilot] server/start.sh: third",
				]);
			}),
		);

		it.effect("a target's own name is read as well as the config's name", () =>
			Effect.gen(function* () {
				const root = yield* tree({ "plugin/pluginfinity.config.ts": RENAMED_TARGET });
				const result = yield* runCli(["logs", "--human"], { cwd: `${root}/plugin`, stateHome: `${root}/state` });
				const headers = result.stdout.filter((line) => line.startsWith("==>"));
				assert.deepStrictEqual(headers, ["==> claude-name/error.log <==", "==> shared-name/error.log <=="]);
			}),
		);

		it.effect("outside a plugin: every directory under the state directory", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--human"], { cwd: root, stateHome: `${root}/state` });
				const headers = result.stdout.filter((line) => line.startsWith("==>"));
				assert.deepStrictEqual(headers, [
					"==> both-targets/error.log <==",
					"==> claude-name/error.log <==",
					"==> other/error.log <==",
					"==> shared-name/error.log <==",
				]);
			}),
		);

		it.effect("--plugin names plugins directly, repeatably, and skips the config", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--human", "--plugin", "other", "--plugin", "both-targets"], {
					cwd: `${root}/plugin`,
					stateHome: `${root}/state`,
				});
				const headers = result.stdout.filter((line) => line.startsWith("==>"));
				assert.deepStrictEqual(headers, ["==> other/error.log <==", "==> both-targets/error.log <=="]);
			}),
		);

		it.effect("--debug shows debug.log instead of error.log", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--human", "--debug"], {
					cwd: `${root}/plugin`,
					stateHome: `${root}/state`,
				});
				assert.include(result.stdout, "==> both-targets/debug.log <==");
				assert.include(result.stdout, "2026-10-06T10:00:01Z [claude] hook/guard.sh: debug detail");
				assert.notInclude(result.stdout, "==> both-targets/error.log <==");
			}),
		);

		it.effect("--debug with no debug.log says how to write one", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--human", "--debug", "--plugin", "other"], {
					cwd: root,
					stateHome: `${root}/state`,
				});
				assert.strictEqual(result.code, 0);
				assert.include(result.stdout, "==> other/debug.log <==");
				assert.include(result.stdout, "  (no debug.log; set PLUGINFINITY_DEBUG=1 to write one)");
			}),
		);

		it.effect("a plugin with no error.log says nothing has been logged", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--human", "--plugin", "quiet"], {
					cwd: root,
					stateHome: `${root}/state`,
				});
				assert.include(result.stdout, "  (no error.log yet; nothing has been logged)");
			}),
		);

		it.effect("--lines keeps the last n lines of each file", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--human", "--lines", "1"], {
					cwd: `${root}/plugin`,
					stateHome: `${root}/state`,
				});
				assert.deepStrictEqual(result.stdout.slice(1), [
					"==> both-targets/error.log <==",
					"2026-10-06T10:00:02Z [copilot] server/start.sh: third",
				]);
			}),
		);

		it.effect("a negative --lines is a usage error", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--lines", "-1"], { cwd: root, stateHome: `${root}/state` });
				assert.strictEqual(result.code, 64);
			}),
		);

		it.effect("no state directory: a clear message, exit 0", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "plugin/pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["logs", "--human"], { cwd: `${root}/plugin`, stateHome: `${root}/state` });
				assert.strictEqual(result.code, 0);
				assert.deepStrictEqual(result.stdout, [
					`No logs yet: ${root}/state/pluginfinity does not exist.`,
					"A plugin's components write there when they log an error; set PLUGINFINITY_DEBUG=1 to write debug.log too.",
				]);
			}),
		);

		it.effect("for an agent: one JSON object with parsed entries and raw lines", () =>
			Effect.gen(function* () {
				const root = yield* tree();
				const result = yield* runCli(["logs", "--agent"], { cwd: `${root}/plugin`, stateHome: `${root}/state` });
				assert.strictEqual(result.code, 0);
				assert.strictEqual(result.stdout.length, 1);
				const report = JSON.parse(result.stdout[0] ?? "");
				assert.deepStrictEqual(Object.keys(report), [
					"engine_version",
					"distribution",
					"ok",
					"directory",
					"found",
					"files",
					"entries",
				]);
				assert.strictEqual(report.ok, true);
				assert.strictEqual(report.found, true);
				assert.strictEqual(report.directory, `${root}/state/pluginfinity`);
				assert.deepStrictEqual(report.files, [
					{
						plugin: "both-targets",
						file: "error.log",
						path: `${root}/state/pluginfinity/both-targets/error.log`,
						present: true,
					},
				]);
				assert.deepStrictEqual(report.entries, [
					{
						ts: "2026-10-06T10:00:00Z",
						host: "claude",
						component: "hook",
						script: "guard.sh",
						message: "first",
						plugin: "both-targets",
						file: "error.log",
					},
					{ raw: "not a log line", plugin: "both-targets", file: "error.log" },
					{
						ts: "2026-10-06T10:00:02Z",
						host: "copilot",
						component: "server",
						script: "start.sh",
						message: "third",
						plugin: "both-targets",
						file: "error.log",
					},
				]);
			}),
		);

		it.effect("for an agent with no state directory: ok, found false, no entries", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "plugin/pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["logs", "--ci"], { cwd: `${root}/plugin`, stateHome: `${root}/state` });
				assert.strictEqual(result.code, 0);
				const report = JSON.parse(result.stdout[0] ?? "");
				assert.strictEqual(report.ok, true);
				assert.strictEqual(report.found, false);
				assert.deepStrictEqual(report.entries, []);
			}),
		);

		it.effect("a broken config is a finding, not a fallback", () =>
			Effect.gen(function* () {
				const root = yield* tree({ "plugin/pluginfinity.config.ts": "export default { name: 3 };\n" });
				const result = yield* runCli(["logs", "--agent"], { cwd: `${root}/plugin`, stateHome: `${root}/state` });
				assert.strictEqual(result.code, 1);
				assert.strictEqual(JSON.parse(result.stdout[0] ?? "").error.tag, "ConfigInvalid");
			}),
		);
	});

	{
		// A bounded follow needs real time: it.live, with the console captured by TestConsole.
		const it = plainIt;
		const followed = (
			args: ReadonlyArray<string>,
			appended: (root: string) => Effect.Effect<void, never, FileSystem.FileSystem>,
			until: (lines: ReadonlyArray<string>) => boolean,
		) =>
			Effect.gen(function* () {
				const root = yield* tree();
				const stop = yield* Deferred.make<void>();
				const run = yield* Effect.forkChild(
					runCli(args, {
						cwd: `${root}/plugin`,
						stateHome: `${root}/state`,
						follow: { stop: Deferred.await(stop), interval: "10 millis" },
					}),
				);
				// Let the tail print, append, then wait until the appended line is out.
				yield* Effect.sleep("100 millis");
				yield* appended(root);
				for (
					let tries = 0;
					tries < 200 && !until(yield* TestConsole.logLines.pipe(Effect.map((l) => l.map(String))));
					tries++
				) {
					yield* Effect.sleep("10 millis");
				}
				yield* Deferred.succeed(stop, undefined);
				return yield* Fiber.join(run);
			}).pipe(Effect.provide(TestConsole.layer));

		it.live("--follow prints the tail, then lines appended later, and ends when told to, exit 0", () =>
			Effect.gen(function* () {
				const result = yield* followed(
					["logs", "--human", "--follow"],
					(root) =>
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							const path = yield* Path.Path;
							yield* fs.writeFileString(
								path.join(root, "state/pluginfinity/both-targets/error.log"),
								`${STATE_TREE["state/pluginfinity/both-targets/error.log"]}2026-10-06T10:00:09Z [claude] hook/late.sh: appended\n`,
							);
						}).pipe(Effect.orDie, Effect.provide(Path.layer)),
					(lines) => lines.includes("2026-10-06T10:00:09Z [claude] hook/late.sh: appended"),
				);
				assert.strictEqual(result.code, 0);
				assert.deepStrictEqual(result.stdout.slice(1), [
					"==> both-targets/error.log <==",
					"2026-10-06T10:00:00Z [claude] hook/guard.sh: first",
					"not a log line",
					"2026-10-06T10:00:02Z [copilot] server/start.sh: third",
					"2026-10-06T10:00:09Z [claude] hook/late.sh: appended",
				]);
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		it.live("--follow for an agent emits one JSON object per line, tail first", () =>
			Effect.gen(function* () {
				const result = yield* followed(
					["logs", "--agent", "--follow", "--lines", "1"],
					(root) =>
						Effect.gen(function* () {
							const fs = yield* FileSystem.FileSystem;
							yield* fs.writeFileString(
								`${root}/state/pluginfinity/both-targets/error.log`,
								`${STATE_TREE["state/pluginfinity/both-targets/error.log"]}2026-10-06T10:00:09Z [claude] hook/late.sh: appended\n`,
							);
						}).pipe(Effect.orDie),
					(lines) => lines.length >= 2,
				);
				assert.strictEqual(result.code, 0);
				const messages = result.stdout.map((line) => JSON.parse(line).message);
				assert.deepStrictEqual(messages, ["third", "appended"]);
			}).pipe(Effect.provide(NodeServices.layer)),
		);
	}
});
