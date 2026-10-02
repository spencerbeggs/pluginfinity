import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { Effect } from "effect";
import { BOTH_TARGETS } from "./fixtures/configs.js";
import { runCli } from "./utils/run.js";
import type { FakeTool } from "./utils/tools.js";
import { fakeTools } from "./utils/tools.js";
import { writeTree } from "./utils/tree.js";

const ALL_PRESENT: Readonly<Record<string, FakeTool>> = {
	npm: "11.0.0",
	claude: "2.1.0",
	copilot: "1.0.3",
	bats: "1.11.0",
	git: "2.50.0",
};

describe("pluginfinity doctor", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("for an agent: one JSON object with engine_version, distribution, ok and checks", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["doctor", "--agent"], { cwd, tools: fakeTools(ALL_PRESENT) });
				assert.strictEqual(result.code, 0);
				assert.strictEqual(result.stdout.length, 1);
				const report = JSON.parse(result.stdout[0] ?? "");
				assert.deepStrictEqual(Object.keys(report), ["engine_version", "distribution", "ok", "checks"]);
				assert.strictEqual(report.ok, true);
				assert.isNull(report.distribution);
				assert.deepStrictEqual(Object.keys(report.checks[0]), [
					"id",
					"status",
					"severity",
					"version",
					"path",
					"remediation",
				]);
				assert.deepStrictEqual(
					report.checks.map((check: { id: string }) => check.id),
					["node", "package-manager", "claude", "copilot", "bats", "git", "config"],
				);
			}),
		);

		it.effect("--ci gets the same JSON object", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["doctor", "--ci"], { cwd, tools: fakeTools(ALL_PRESENT) });
				assert.strictEqual(JSON.parse(result.stdout[0] ?? "").ok, true);
			}),
		);

		it.effect("for people: a grouped checklist with a remediation line under each failure", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["doctor"], { cwd, tools: fakeTools({ ...ALL_PRESENT, claude: "missing" }) });
				assert.strictEqual(result.code, 0);
				assert.include(result.stdout, "Hosts");
				assert.include(result.stdout, "  ✗ claude: not found");
				assert.include(result.stdout, "      Install claude and make sure `claude` is on PATH.");
				assert.include(result.stdout, "  ✓ copilot: found 1.0.3");
			}),
		);

		it.effect("a failing required check still exits 0 without --strict", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["doctor", "--agent"], {
					cwd,
					tools: fakeTools({ ...ALL_PRESENT, claude: "missing" }),
				});
				assert.strictEqual(result.code, 0);
				assert.strictEqual(JSON.parse(result.stdout[0] ?? "").ok, false);
			}),
		);

		it.effect("--strict exits 1 when a required check fails", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["doctor", "--strict"], {
					cwd,
					tools: fakeTools({ ...ALL_PRESENT, claude: "missing" }),
				});
				assert.strictEqual(result.code, 1);
			}),
		);

		it.effect("--strict exits 0 when only a warning fails", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["doctor", "--strict"], {
					cwd,
					tools: fakeTools({ ...ALL_PRESENT, bats: "missing" }),
				});
				assert.strictEqual(result.code, 0);
			}),
		);

		it.effect("a broken config is a check, not a crash", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": "export default { name: 1 };\n" });
				const result = yield* runCli(["doctor", "--strict", "--agent"], { cwd, tools: fakeTools(ALL_PRESENT) });
				assert.strictEqual(result.code, 1);
				const config = JSON.parse(result.stdout[0] ?? "").checks.find((check: { id: string }) => check.id === "config");
				assert.strictEqual(config.status, "fail");
				assert.strictEqual(config.path, `${cwd}/pluginfinity.config.ts`);
				assert.isString(config.remediation.hint);
			}),
		);
	});
});
