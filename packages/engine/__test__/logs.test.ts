import { assert, describe, it, layer } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, FileSystem, Layer, Path } from "effect";
import { listLogPlugins, logDirectory, parseLogLine, readLog, readLogFrom } from "../src/index.js";

const Volume = Layer.merge(
	MemoryFileSystem.layerWith({
		"/state/pluginfinity/alpha/error.log":
			"2026-10-06T10:00:00Z [claude] hook/guard.sh: first\n2026-10-06T10:00:01Z [copilot] server/start.sh: second: with colon\n",
		"/state/pluginfinity/alpha/debug.log": "2026-10-06T10:00:02Z [claude] hook/guard.sh: dbg\n",
		"/state/pluginfinity/beta/error.log": "not a log line\n2026-10-06T10:00:03Z [claude] monitor/watch.sh: third\n",
		"/state/pluginfinity/stray.txt": "a file, not a plugin directory",
		"/state/pluginfinity/partial/error.log": "2026-10-06T10:00:04Z [claude] script/x.sh: whole\n2026-10-06T10:0",
	}),
	Path.layer,
);

describe("parseLogLine", () => {
	it("splits a log line into its fields, keeping colons in the message", () => {
		assert.deepStrictEqual(
			parseLogLine("2026-10-06T10:00:01Z [copilot] server/start.sh: second: with colon", "alpha", "error.log"),
			{
				ts: "2026-10-06T10:00:01Z",
				host: "copilot",
				component: "server",
				script: "start.sh",
				message: "second: with colon",
				plugin: "alpha",
				file: "error.log",
			},
		);
	});

	it("passes a line that does not parse through as raw", () => {
		assert.deepStrictEqual(parseLogLine("not a log line", "beta", "error.log"), {
			raw: "not a log line",
			plugin: "beta",
			file: "error.log",
		});
	});

	it("rejects an unknown component", () => {
		const parsed = parseLogLine("2026-10-06T10:00:01Z [claude] other/x.sh: m", "a", "error.log");
		assert.property(parsed, "raw");
	});
});

layer(Volume)("log files", (it) => {
	it.effect("logDirectory is <state>/pluginfinity/<plugin>", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* logDirectory("/state", "alpha"), "/state/pluginfinity/alpha");
		}),
	);

	it.effect("listLogPlugins lists plugin directories, sorted, ignoring stray files", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* listLogPlugins("/state"), ["alpha", "beta", "partial"]);
		}),
	);

	it.effect("listLogPlugins is empty when there is no state directory", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* listLogPlugins("/nowhere"), []);
		}),
	);

	it.effect("readLog returns the last n lines and the offset after the last complete line", () =>
		Effect.gen(function* () {
			const tail = yield* readLog({ stateHome: "/state", plugin: "alpha", file: "error.log", lines: 1 });
			assert.isTrue(tail.present);
			assert.strictEqual(tail.path, "/state/pluginfinity/alpha/error.log");
			assert.deepStrictEqual(tail.lines, ["2026-10-06T10:00:01Z [copilot] server/start.sh: second: with colon"]);
			const fs = yield* FileSystem.FileSystem;
			assert.strictEqual(tail.offset, (yield* fs.readFileString(tail.path)).length);
			const all = yield* readLog({ stateHome: "/state", plugin: "alpha", file: "error.log", lines: 50 });
			assert.lengthOf(all.lines, 2);
		}),
	);

	it.effect("readLog reports an absent file as not present", () =>
		Effect.gen(function* () {
			const tail = yield* readLog({ stateHome: "/state", plugin: "beta", file: "debug.log", lines: 5 });
			assert.isFalse(tail.present);
			assert.deepStrictEqual(tail.lines, []);
			assert.strictEqual(tail.offset, 0);
		}),
	);

	it.effect("readLog holds back an unterminated last line", () =>
		Effect.gen(function* () {
			const tail = yield* readLog({ stateHome: "/state", plugin: "partial", file: "error.log", lines: 50 });
			assert.deepStrictEqual(tail.lines, ["2026-10-06T10:00:04Z [claude] script/x.sh: whole"]);
		}),
	);

	it.effect("readLogFrom returns only what was appended, and restarts after a truncation", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const file = "/state/pluginfinity/grow/error.log";
			yield* fs.makeDirectory("/state/pluginfinity/grow", { recursive: true });
			yield* fs.writeFileString(file, "one\n");
			const first = yield* readLogFrom(file, 0);
			assert.deepStrictEqual(first.lines, ["one"]);
			const idle = yield* readLogFrom(file, first.offset);
			assert.deepStrictEqual(idle.lines, []);
			assert.strictEqual(idle.offset, first.offset);
			yield* fs.writeFileString(file, "one\ntwo\nthr");
			const grown = yield* readLogFrom(file, first.offset);
			assert.deepStrictEqual(grown.lines, ["two"]);
			yield* fs.writeFileString(file, "x\n");
			const truncated = yield* readLogFrom(file, grown.offset);
			assert.deepStrictEqual(truncated.lines, ["x"]);
		}),
	);

	it.effect("readLogFrom on a file that does not exist is empty", () =>
		Effect.gen(function* () {
			const result = yield* readLogFrom("/state/pluginfinity/none/error.log", 0);
			assert.deepStrictEqual(result, { lines: [], offset: 0 });
		}),
	);
});
