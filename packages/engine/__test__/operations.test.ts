import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { ScriptedSpawner } from "@effected/commands";
import { Effect, FileSystem, Path } from "effect";
import { build, preparePlugins, validate } from "../src/index.js";
import {
	HOOKED,
	HOOKED_EXEC,
	HOOKED_UNSUPPORTED,
	ONLY_COPILOT,
	PACKAGE_JSON,
	SYNTAX_ERROR,
	VALID,
} from "./fixtures/configs.js";
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

describe("build with hooks", () => {
	/** A hooked plugin: a script per host, a helper both source, and a non-executable mode on one. */
	const hookedPlugin = (config: string = HOOKED, extra: Readonly<Record<string, string>> = {}) =>
		writeTree({
			"pluginfinity.config.ts": config,
			"package.json": PACKAGE_JSON,
			"hooks/start.sh": "#!/usr/bin/env bash\n",
			"hooks/start.copilot.sh": "#!/usr/bin/env bash\n",
			"hooks/lib/output.sh": "emit() { :; }\n",
			...extra,
		});

	layer(NodeServices.layer)((it) => {
		it.effect("each target gets its hooks file, its own scripts and the shared helpers, not the other's script", () =>
			Effect.gen(function* () {
				const root = yield* hookedPlugin();
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.deepStrictEqual(
					builds.map((entry) => [entry.target, entry.plan.added]),
					[
						["claude", [".claude-plugin/plugin.json", "hooks/hooks.json", "hooks/lib/output.sh", "hooks/start.sh"]],
						[
							"copilot",
							["com.github.copilot/hooks/hooks.json", "hooks/lib/output.sh", "hooks/start.copilot.sh", "plugin.json"],
						],
					],
				);
			}),
		);

		it.effect("a copied script keeps its source mode", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin();
				yield* fs.chmod(path.join(root, "hooks/start.sh"), 0o755);
				yield* build({ selection: nearest(root), targets: ["claude"], check: false });
				const info = yield* fs.stat(path.join(root, "builds/claude/hooks/start.sh"));
				assert.strictEqual(info.mode & 0o777, 0o755);
			}),
		);

		it.effect("a missing script is HookScriptInvalid naming it", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin();
				yield* fs.remove(path.join(root, "hooks/start.copilot.sh"));
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "HookScriptInvalid");
				if (error._tag !== "HookScriptInvalid") return;
				assert.deepStrictEqual([error.script, error.problem], ["hooks/start.copilot.sh", "missing"]);
			}),
		);

		it.effect("under exec, a script without the executable bit is HookScriptInvalid", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin(HOOKED_EXEC);
				yield* fs.chmod(path.join(root, "hooks/start.sh"), 0o644);
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "HookScriptInvalid");
				if (error._tag !== "HookScriptInvalid") return;
				assert.strictEqual(error.problem, "not-executable");
			}),
		);

		it.effect("an event the target lacks is HookEventUnsupported naming it", () =>
			Effect.gen(function* () {
				const root = yield* hookedPlugin(HOOKED_UNSUPPORTED);
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "HookEventUnsupported");
				if (error._tag !== "HookEventUnsupported") return;
				assert.deepStrictEqual([error.target, error.events], ["copilot", ["Setup"]]);
			}),
		);

		it.effect("a source hooks/hooks.json is a PathConflict on Claude, which generates that file", () =>
			Effect.gen(function* () {
				const root = yield* hookedPlugin(HOOKED, { "hooks/hooks.json": "{}\n" });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.deepStrictEqual([error.target, error.file], ["claude", "hooks/hooks.json"]);
			}),
		);
	});
});

describe("build with skills", () => {
	const SKILL = [
		"---",
		"name: alpha",
		"description: Does alpha.",
		"when_to_use: alpha work",
		"---",
		"",
		"# Alpha",
		"<!-- pluginfinity:only claude -->",
		"Claude only.",
		"<!-- /pluginfinity:only -->",
		"",
	].join("\n");

	/** A plugin with one skill, `alpha`, and any extra files. */
	const skillPlugin = (files: Readonly<Record<string, string>> = {}) =>
		writeTree({
			"pluginfinity.config.ts": VALID,
			"package.json": PACKAGE_JSON,
			"skills/alpha/SKILL.md": SKILL,
			"skills/alpha/references/guide.md":
				"Guide.\n<!-- pluginfinity:only copilot -->\nCopilot only.\n<!-- /pluginfinity:only -->\n",
			"skills/alpha/assets/data.json": "{}\n",
			...files,
		});

	const read = (root: string, file: string) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			return yield* fs.readFileString(path.join(root, file));
		});

	const failure = (root: string) =>
		Effect.flip(build({ selection: nearest(root), targets: [], check: false })).pipe(
			Effect.map((error) => {
				if (error._tag !== "ComponentInvalid") throw new Error(`expected ComponentInvalid, got ${error._tag}`);
				return error;
			}),
		);

	layer(NodeServices.layer)((it) => {
		it.effect("each target gets the skill with its own frontmatter, host blocks applied, and every support file", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.strictEqual(
					yield* read(root, "builds/claude/skills/alpha/SKILL.md"),
					"---\nname: alpha\ndescription: Does alpha.\nwhen_to_use: alpha work\n---\n\n# Alpha\nClaude only.\n",
				);
				assert.strictEqual(
					yield* read(root, "builds/copilot/skills/alpha/SKILL.md"),
					'---\nname: alpha\ndescription: "Does alpha. Also use when: alpha work"\n---\n\n# Alpha\n',
				);
				assert.strictEqual(yield* read(root, "builds/claude/skills/alpha/references/guide.md"), "Guide.\n");
				assert.strictEqual(
					yield* read(root, "builds/copilot/skills/alpha/references/guide.md"),
					"Guide.\nCopilot only.\n",
				);
				assert.strictEqual(yield* read(root, "builds/copilot/skills/alpha/assets/data.json"), "{}\n");
			}),
		);

		it.effect("a skill without name gets its directory name on every target", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({ "skills/alpha/SKILL.md": "---\ndescription: Does alpha.\n---\nBody.\n" });
				yield* build({ selection: nearest(root), targets: ["copilot"], check: false });
				assert.include(yield* read(root, "builds/copilot/skills/alpha/SKILL.md"), "name: alpha\n");
			}),
		);

		it.effect("targets.copilot: false leaves the skill out of the Copilot build only", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": "---\ndescription: Does alpha.\ntargets:\n  copilot: false\n---\nBody.\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/copilot/skills/alpha")));
				assert.notInclude(yield* read(root, "builds/claude/skills/alpha/SKILL.md"), "targets");
			}),
		);

		it.effect("an unknown frontmatter field is ComponentInvalid naming it", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({ "skills/alpha/SKILL.md": "---\ndescription: x\ncolour: red\n---\n" });
				const error = yield* failure(root);
				assert.deepStrictEqual(
					error.issues.map((found) => found.key),
					["colour"],
				);
			}),
		);

		it.effect("frontmatter that is not valid YAML is ComponentInvalid", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": "---\ndescription: x\nwhen_to_use: a, Tests: 0/0\n---\n",
				});
				const error = yield* failure(root);
				assert.include(error.message, "not valid YAML");
				assert.match(error.issues[0]?.key ?? "", /^line 3, column \d+$/);
			}),
		);

		it.effect("a name that differs from the directory is ComponentInvalid", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({ "skills/alpha/SKILL.md": "---\nname: beta\ndescription: x\n---\n" });
				const error = yield* failure(root);
				assert.include(error.message, `must equal the directory name "alpha"`);
			}),
		);

		it.effect("a targets block for an unknown target is ComponentInvalid", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": "---\ndescription: x\ntargets:\n  vscode: false\n---\n",
				});
				const error = yield* failure(root);
				assert.deepStrictEqual(
					error.issues.map((found) => found.key),
					["targets.vscode"],
				);
			}),
		);

		it.effect("a description over 1024 characters on Copilot is ComponentInvalid for copilot", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": `---\ndescription: ${"d".repeat(1000)}\nwhen_to_use: ${"w".repeat(100)}\n---\n`,
				});
				const error = yield* failure(root);
				assert.strictEqual(error.target, "copilot");
				assert.include(error.message, "over the 1024 limit");
			}),
		);

		it.effect("a malformed host block in a support file is ComponentInvalid naming that file and line", () =>
			Effect.gen(function* () {
				const path = yield* Path.Path;
				const root = yield* skillPlugin({
					"skills/alpha/references/guide.md": "a\n<!-- pluginfinity:only claude -->\n",
				});
				const error = yield* failure(root);
				assert.strictEqual(error.path, path.join(root, "skills/alpha/references/guide.md"));
				assert.include(error.message, "line 2");
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
