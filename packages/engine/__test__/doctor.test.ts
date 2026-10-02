import { NodeServices } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import { CurrentDistribution } from "@effected/engine";
import { Duration, Effect, Option, Path } from "effect";
import type { DoctorCheck, DoctorReport } from "../src/index.js";
import { ENGINE_VERSION, runDoctor } from "../src/index.js";
import { HANGS_ON_LOAD, ONLY_COPILOT, SYNTAX_ERROR, VALID } from "./fixtures/configs.js";
import type { FakeTool } from "./utils/tools.js";
import { fakeTools } from "./utils/tools.js";
import { writeTree } from "./utils/tree.js";

const ALL_PRESENT: Readonly<Record<string, FakeTool>> = {
	npm: "11.0.0",
	pnpm: "12.8.2",
	claude: "2.1.0",
	copilot: "1.0.3",
	bats: "1.11.0",
	git: "2.50.0",
};

const byId = (report: DoctorReport, id: string): DoctorCheck => {
	const found = report.checks.find((check) => check.id === id);
	if (found === undefined) throw new Error(`no check ${id}`);
	return found;
};

const doctorIn = (
	files: Readonly<Record<string, string>>,
	tools: Readonly<Record<string, FakeTool>>,
	nodeVersion = "24.11.0",
) =>
	Effect.gen(function* () {
		const root = yield* writeTree(files);
		return yield* runDoctor({ selection: { _tag: "Nearest", start: root }, nodeVersion }).pipe(
			Effect.provide(fakeTools(tools)),
		);
	});

describe("runDoctor", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("everything present: every check passes and the report is ok", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn({ "pluginfinity.config.ts": VALID, "pnpm-lock.yaml": "" }, ALL_PRESENT);
				assert.isTrue(report.ok);
				assert.strictEqual(report.engineVersion, ENGINE_VERSION);
				assert.isNull(report.distribution);
				assert.deepStrictEqual(
					report.checks.map((check) => [check.id, check.status, check.severity]),
					[
						["node", "pass", "required"],
						["package-manager", "pass", "warning"],
						["claude", "pass", "required"],
						["copilot", "pass", "required"],
						["bats", "pass", "warning"],
						["git", "pass", "warning"],
						["config", "pass", "required"],
					],
				);
				assert.strictEqual(byId(report, "package-manager").label, "pnpm");
				assert.strictEqual(byId(report, "claude").version, "2.1.0");
			}),
		);

		it.effect("a missing targeted host is a required failure with a remediation", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn({ "pluginfinity.config.ts": VALID }, { ...ALL_PRESENT, claude: "missing" });
				const claude = byId(report, "claude");
				assert.deepStrictEqual([claude.status, claude.severity, claude.detail], ["fail", "required", "not found"]);
				assert.isNotNull(claude.remediation);
				assert.isFalse(report.ok);
			}),
		);

		it.effect("with a config, only its targets are required; the others are information", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn(
					{ "pluginfinity.config.ts": ONLY_COPILOT },
					{ ...ALL_PRESENT, claude: "missing" },
				);
				assert.strictEqual(byId(report, "claude").severity, "info");
				assert.strictEqual(byId(report, "copilot").severity, "required");
				assert.isTrue(report.ok);
			}),
		);

		it.effect("with no config, every host is information and the config check is information", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn({ "README.md": "" }, { ...ALL_PRESENT, claude: "missing", copilot: "missing" });
				assert.deepStrictEqual(
					[byId(report, "claude").severity, byId(report, "copilot").severity, byId(report, "config").severity],
					["info", "info", "info"],
				);
				assert.isTrue(report.ok);
			}),
		);

		it.effect("with --all, the hosts required are the union across every config", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"plugins/a/pluginfinity.config.ts": ONLY_COPILOT,
					"plugins/b/pluginfinity.config.ts": VALID,
				});
				const report = yield* runDoctor({ selection: { _tag: "All", start: root }, nodeVersion: "24.11.0" }).pipe(
					Effect.provide(fakeTools(ALL_PRESENT)),
				);
				assert.strictEqual(byId(report, "claude").severity, "required");
				assert.strictEqual(report.checks.filter((check) => check.id === "config").length, 2);
			}),
		);

		it.effect("a config that fails to load is a required failure carrying its path", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* writeTree({ "pluginfinity.config.ts": SYNTAX_ERROR });
				const report = yield* runDoctor({ selection: { _tag: "Nearest", start: root }, nodeVersion: "24.11.0" }).pipe(
					Effect.provide(fakeTools(ALL_PRESENT)),
				);
				const config = byId(report, "config");
				assert.deepStrictEqual([config.status, config.severity], ["fail", "required"]);
				assert.strictEqual(config.path, path.join(root, "pluginfinity.config.ts"));
				assert.isFalse(report.ok);
			}),
		);

		it.effect("a version that will not parse is found with an unknown version", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn({ "pluginfinity.config.ts": VALID }, { ...ALL_PRESENT, git: "unparseable" });
				const git = byId(report, "git");
				assert.deepStrictEqual([git.status, git.version, git.detail], ["pass", null, "found (version unknown)"]);
			}),
		);

		it.effect("a node below the floor is a required failure", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn({ "pluginfinity.config.ts": VALID }, ALL_PRESENT, "24.10.0");
				assert.deepStrictEqual([byId(report, "node").status, byId(report, "node").severity], ["fail", "required"]);
				assert.isFalse(report.ok);
			}),
		);

		it.effect("a missing warning-level tool never makes the report fail", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn({ "pluginfinity.config.ts": VALID }, { ...ALL_PRESENT, bats: "missing" });
				assert.strictEqual(byId(report, "bats").status, "fail");
				assert.isTrue(report.ok);
			}),
		);

		it.effect("no lockfile: the package manager checked is npm", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn({ "pluginfinity.config.ts": VALID }, ALL_PRESENT);
				assert.strictEqual(byId(report, "package-manager").label, "npm");
			}),
		);

		it.effect("the report names the distribution a carrier passed", () =>
			Effect.gen(function* () {
				const report = yield* doctorIn({ "pluginfinity.config.ts": VALID }, ALL_PRESENT).pipe(
					Effect.provideService(CurrentDistribution, Option.some({ name: "pluginfinity", version: "0.4.0" })),
				);
				assert.deepStrictEqual(report.distribution, { name: "pluginfinity", version: "0.4.0" });
			}),
		);
	});
});

// Real time, not TestClock: the config load is real IO, so a virtual clock
// advanced before the probe starts never fires the probe's timeout.
describe("runDoctor timeouts", () => {
	it.live("a check that never answers times out instead of hanging doctor", () =>
		Effect.gen(function* () {
			const root = yield* writeTree({ "pluginfinity.config.ts": VALID });
			const report = yield* runDoctor({
				selection: { _tag: "Nearest", start: root },
				nodeVersion: "24.11.0",
				timeout: Duration.millis(50),
			}).pipe(Effect.provide(fakeTools({ ...ALL_PRESENT, copilot: "hang" })));
			const copilot = byId(report, "copilot");
			assert.strictEqual(copilot.status, "fail");
			assert.include(copilot.detail, "did not answer within");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);

	it.live("a config whose import never settles times out instead of hanging doctor", () =>
		Effect.gen(function* () {
			const root = yield* writeTree({ "pluginfinity.config.ts": HANGS_ON_LOAD });
			const report = yield* runDoctor({
				selection: { _tag: "Nearest", start: root },
				nodeVersion: "24.11.0",
				timeout: Duration.millis(200),
			}).pipe(Effect.provide(fakeTools(ALL_PRESENT)));
			const config = byId(report, "config");
			assert.deepStrictEqual([config.status, config.severity], ["fail", "required"]);
			assert.include(config.detail, "did not finish within");
		}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
	);
});
