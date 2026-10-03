import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { ScriptedSpawner } from "@effected/commands";
import { Effect, FileSystem, Path } from "effect";
import { build, preparePlugins, validate } from "../src/index.js";
import { ONLY_COPILOT, PACKAGE_JSON, SYNTAX_ERROR, VALID } from "./fixtures/configs.js";
import { writeTree } from "./utils/tree.js";

describe("preparePlugins", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("with no --target, runs every enabled target", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": VALID });
				const [prepared] = yield* preparePlugins({ selection: { _tag: "Nearest", start: root }, targets: [] });
				assert.deepStrictEqual(prepared?.targets, ["claude", "copilot"]);
			}),
		);

		it.effect("a requested target the config does not enable is TargetNotEnabled naming the file", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* writeTree({ "pluginfinity.config.ts": ONLY_COPILOT });
				const error = yield* Effect.flip(
					preparePlugins({ selection: { _tag: "Nearest", start: root }, targets: ["claude"] }),
				);
				assert.strictEqual(error._tag, "TargetNotEnabled");
				assert.strictEqual(error.path, path.join(root, "pluginfinity.config.ts"));
			}),
		);

		it.effect("--all with no config below the start is ConfigNotFound", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "README.md": "" });
				const error = yield* Effect.flip(preparePlugins({ selection: { _tag: "All", start: root }, targets: [] }));
				assert.strictEqual(error._tag, "ConfigNotFound");
			}),
		);

		it.effect("--all stops at the first config that fails, naming that file", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"plugins/a/pluginfinity.config.ts": VALID,
					"plugins/b/pluginfinity.config.ts": SYNTAX_ERROR,
				});
				const error = yield* Effect.flip(preparePlugins({ selection: { _tag: "All", start: root }, targets: [] }));
				assert.strictEqual(error._tag, "ConfigLoadFailed");
				assert.strictEqual(error.path, path.join(root, "plugins", "b", "pluginfinity.config.ts"));
			}),
		);

		it.effect("an explicit --config that does not exist is ConfigNotFound naming that file", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* writeTree({ "pluginfinity.config.ts": VALID });
				const missing = path.join(root, "other.config.ts");
				const error = yield* Effect.flip(preparePlugins({ selection: { _tag: "File", path: missing }, targets: [] }));
				assert.strictEqual(error._tag, "ConfigNotFound");
				assert.strictEqual(error.path, missing);
			}),
		);
	});
});

const CLAUDE_MANIFEST = "builds/claude/.claude-plugin/plugin.json";
const COPILOT_MANIFEST = "builds/copilot/plugin.json";

/** A plugin with both targets and a package version. */
const plugin = () => writeTree({ "pluginfinity.config.ts": VALID, "package.json": PACKAGE_JSON });

const nearest = (start: string) => ({ _tag: "Nearest", start }) as const;

/** A spawner where both host CLIs accept the build of `valid-plugin` at 1.2.3. */
const acceptingHosts = () =>
	ScriptedSpawner.make((command) =>
		command === "copilot"
			? { stdout: JSON.stringify([{ name: "valid-plugin", version: "1.2.3", source: "external", enabled: true }]) }
			: {},
	);

describe("build", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("writes each target's manifest under builds/<id>/ with the package version", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* plugin();
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.deepStrictEqual(
					builds.map((entry) => [entry.target, entry.plan.added]),
					[
						["claude", [".claude-plugin/plugin.json"]],
						["copilot", ["plugin.json"]],
					],
				);
				const claude = JSON.parse(yield* fs.readFileString(path.join(root, CLAUDE_MANIFEST)));
				assert.strictEqual(claude.name, "valid-claude");
				assert.strictEqual(claude.version, "1.2.3");
				const copilot = JSON.parse(yield* fs.readFileString(path.join(root, COPILOT_MANIFEST)));
				assert.strictEqual(copilot.name, "valid-plugin");
				assert.isString(copilot.$schema);
			}),
		);

		it.effect("--check after a build passes and reports nothing to do", () =>
			Effect.gen(function* () {
				const root = yield* plugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const builds = yield* build({ selection: nearest(root), targets: [], check: true });
				assert.isTrue(builds.every((entry) => entry.plan.clean));
			}),
		);

		it.effect("--check with drift is BuildStale naming each drifted file, and writes nothing", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* plugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				yield* fs.writeFileString(path.join(root, COPILOT_MANIFEST), "{}\n");
				yield* fs.writeFileString(path.join(root, "builds/claude/stray.md"), "stray\n");
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: true }));
				assert.strictEqual(error._tag, "BuildStale");
				if (error._tag !== "BuildStale") return;
				assert.deepStrictEqual(
					error.targets.map((drift) => [drift.target, drift.changed, drift.removed]),
					[
						["claude", [], ["stray.md"]],
						["copilot", ["plugin.json"], []],
					],
				);
				assert.include(error.message, "claude would have removed stray.md");
				assert.include(error.message, "copilot would have changed plugin.json");
				assert.strictEqual(yield* fs.readFileString(path.join(root, COPILOT_MANIFEST)), "{}\n");
			}),
		);

		it.effect("a missing package.json is PackageVersionMissing naming the file", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* writeTree({ "pluginfinity.config.ts": VALID });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PackageVersionMissing");
				if (error._tag !== "PackageVersionMissing") return;
				assert.strictEqual(error.path, path.join(root, "package.json"));
			}),
		);

		it.effect("a package.json without a version string is PackageVersionMissing", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": VALID, "package.json": `{ "version": 3 }\n` });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PackageVersionMissing");
			}),
		);

		it.effect("a config error comes before any build work", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": ONLY_COPILOT });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: ["claude"], check: false }));
				assert.strictEqual(error._tag, "TargetNotEnabled");
			}),
		);
	});
});

describe("validate", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("with --no-host, a current build passes without running any host", () =>
			Effect.gen(function* () {
				const root = yield* plugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const spawner = acceptingHosts();
				const validations = yield* validate({ selection: nearest(root), targets: [], skipHosts: true }).pipe(
					Effect.provide(spawner.layer),
				);
				assert.deepStrictEqual(
					validations.map((entry) => entry.host),
					["skipped", "skipped"],
				);
				assert.strictEqual(spawner.spawns.length, 0);
			}),
		);

		it.effect("an out-of-date build fails BuildStale before any host runs", () =>
			Effect.gen(function* () {
				const root = yield* plugin();
				const spawner = acceptingHosts();
				const error = yield* Effect.flip(
					validate({ selection: nearest(root), targets: [], skipHosts: false }).pipe(Effect.provide(spawner.layer)),
				);
				assert.strictEqual(error._tag, "BuildStale");
				assert.strictEqual(spawner.spawns.length, 0);
			}),
		);

		it.effect("runs claude plugin validate and copilot's plugin list on each build directory", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* plugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const spawner = acceptingHosts();
				const validations = yield* validate({ selection: nearest(root), targets: [], skipHosts: false }).pipe(
					Effect.provide(spawner.layer),
				);
				assert.deepStrictEqual(
					validations.map((entry) => entry.host),
					["passed", "passed"],
				);
				assert.deepStrictEqual(
					spawner.spawns.map((spawn) => [spawn.command, ...spawn.args]),
					[
						["claude", "plugin", "validate", path.join(root, "builds", "claude")],
						["copilot", "--plugin-dir", path.join(root, "builds", "copilot"), "plugin", "list", "--json"],
					],
				);
			}),
		);

		it.effect("claude exiting non-zero is HostRejected carrying what it printed", () =>
			Effect.gen(function* () {
				const root = yield* plugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const spawner = ScriptedSpawner.make(() => ({ stdout: "✘ name: bad\n", exit: 1 }));
				const error = yield* Effect.flip(
					validate({ selection: nearest(root), targets: ["claude"], skipHosts: false }).pipe(
						Effect.provide(spawner.layer),
					),
				);
				assert.strictEqual(error._tag, "HostRejected");
				if (error._tag !== "HostRejected") return;
				assert.strictEqual(error.target, "claude");
				assert.strictEqual(error.output, "✘ name: bad");
			}),
		);

		it.effect("copilot not listing the plugin by its manifest name is HostRejected", () =>
			Effect.gen(function* () {
				const root = yield* plugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const spawner = ScriptedSpawner.make(() => ({ stdout: "[]" }));
				const error = yield* Effect.flip(
					validate({ selection: nearest(root), targets: ["copilot"], skipHosts: false }).pipe(
						Effect.provide(spawner.layer),
					),
				);
				assert.strictEqual(error._tag, "HostRejected");
				if (error._tag !== "HostRejected") return;
				assert.include(error.output, `"valid-plugin"`);
			}),
		);

		it.effect("a host CLI that is not installed is HostRejected, not a crash", () =>
			Effect.gen(function* () {
				const root = yield* plugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const spawner = ScriptedSpawner.make((command) => ScriptedSpawner.notFound(command));
				const error = yield* Effect.flip(
					validate({ selection: nearest(root), targets: ["claude"], skipHosts: false }).pipe(
						Effect.provide(spawner.layer),
					),
				);
				assert.strictEqual(error._tag, "HostRejected");
			}),
		);
	});
});
