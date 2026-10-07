import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import { ScriptedSpawner } from "@effected/commands";
import { Effect, FileSystem, Path } from "effect";
import { hookLibFiles } from "../src/hook-lib.js";
import type { BuildNote } from "../src/index.js";
import { ENGINE_VERSION, build, isBuildError, preparePlugins, validate } from "../src/index.js";
import {
	ENVED,
	ENVED_NO_HOOKS,
	ENVED_OVERRIDDEN,
	ENVED_SETUP_MISSING,
	ENVED_SHORT_TIMEOUT,
	FILES_BUILDS,
	FILES_COLLIDE,
	FILES_MISSING,
	FILES_OVERLAP,
	FILES_PER_TARGET,
	FILES_PER_TARGET_MISSING,
	FILES_RESERVED,
	FILES_SHADOW,
	FILES_SHADOW_SERVER,
	FILES_SHARE,
	HOOKED,
	HOOKED_COMMAND,
	HOOKED_EXEC,
	HOOKED_UNSUPPORTED,
	LSP_UNRESOLVED,
	MONITORED,
	MONITORED_COLLIDE,
	MONITORED_EXEC_EQUALS,
	MONITORED_MISSING,
	MONITOR_SKILL,
	MONITOR_SKILL_RENAMED,
	MONITOR_SKILL_UNKNOWN,
	NOTED,
	NOTED_AGENT,
	NOTED_SKILL,
	ONLY_COPILOT,
	OWN_MCP,
	OWN_MCP_AGENT,
	PACKAGE_JSON,
	PLAIN_SKILL,
	SERVER_CLIMB_INSIDE,
	SERVER_DIR_COMMAND,
	SERVER_DIR_ENV,
	SERVER_DIR_SLASH,
	SERVER_DOTTED,
	SERVER_ESCAPE,
	SERVER_EXEC_COMMAND,
	SERVER_FILE_SLASH,
	SERVER_HOST_SPELLING,
	SERVER_PATH_ENV,
	SERVER_PLAIN,
	SERVER_SHARED_LAUNCHER,
	SHADOW_SERVERS,
	SYNTAX_ERROR,
	VALID,
	WITH_MCP,
	WITH_SERVERS,
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
						["claude", [".claude-plugin/plugin.json", "lib/pluginfinity/host.sh", "lib/pluginfinity/log.sh"]],
						["copilot", ["lib/pluginfinity/host.sh", "lib/pluginfinity/log.sh", "plugin.json"]],
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

		it.effect("builds servers, ships their launchers, files entries and the server library", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": WITH_SERVERS,
					"package.json": PACKAGE_JSON,
					"bin/start-mcp.sh": "#!/bin/sh\n",
					"bin/start-lsp.sh": "#!/bin/sh\n",
					"bin/unused.sh": "#!/bin/sh\n",
					"share/data.json": "{}\n",
				});
				yield* fs.chmod(path.join(root, "bin/start-mcp.sh"), 0o755);
				yield* build({ selection: nearest(root), targets: [], check: false });
				for (const file of [
					"builds/claude/bin/start-mcp.sh",
					"builds/claude/bin/start-lsp.sh",
					"builds/claude/share/data.json",
					"builds/claude/lib/pluginfinity/server.sh",
					"builds/copilot/mcp.json",
					"builds/copilot/com.github.copilot/lsp.json",
					"builds/copilot/lib/pluginfinity/server.sh",
				])
					assert.isTrue(yield* fs.exists(path.join(root, file)), file);
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/bin/unused.sh")));
				// Claude's servers live inline in plugin.json; no root server file, which a .gitignore could exclude.
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/.mcp.json")));
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/.lsp.json")));
				const manifest = JSON.parse(
					yield* fs.readFileString(path.join(root, "builds/claude/.claude-plugin/plugin.json")),
				);
				assert.deepStrictEqual(Object.keys(manifest), ["name", "version", "description", "mcpServers", "lspServers"]);
				assert.strictEqual(manifest.mcpServers.mcp.args[0], `\${CLAUDE_PLUGIN_ROOT}/bin/start-mcp.sh`);
				assert.strictEqual(manifest.mcpServers.mcp.env.PLUGINFINITY_HOST, "claude");
				assert.strictEqual(manifest.lspServers.md.args[0], `\${CLAUDE_PLUGIN_ROOT}/bin/start-lsp.sh`);
				assert.deepStrictEqual(manifest.lspServers.md.extensionToLanguage, { ".md": "markdown" });
				const copilot = JSON.parse(yield* fs.readFileString(path.join(root, COPILOT_MANIFEST)));
				assert.notProperty(copilot, "mcpServers");
				assert.notProperty(copilot, "lspServers");
				const mode = (yield* fs.stat(path.join(root, "builds/claude/bin/start-mcp.sh"))).mode & 0o777;
				assert.strictEqual(mode, 0o755);
				const check = yield* build({ selection: nearest(root), targets: [], check: true });
				assert.isTrue(check.every((target) => target.plan.clean));
			}),
		);

		it.effect("a .mcp.json or .lsp.json an earlier Claude build wrote is removed, and --check reports it", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": WITH_SERVERS,
					"package.json": PACKAGE_JSON,
					"bin/start-mcp.sh": "#!/bin/sh\n",
					"bin/start-lsp.sh": "#!/bin/sh\n",
					"share/data.json": "{}\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				yield* fs.writeFileString(path.join(root, "builds/claude/.mcp.json"), `{ "mcpServers": {} }\n`);
				yield* fs.writeFileString(path.join(root, "builds/claude/.lsp.json"), "{}\n");
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: true }));
				assert.strictEqual(error._tag, "BuildStale");
				if (error._tag !== "BuildStale") return;
				assert.deepStrictEqual(
					error.targets.map((drift) => [drift.target, drift.added, drift.changed, [...drift.removed].sort()]),
					[["claude", [], [], [".lsp.json", ".mcp.json"]]],
				);
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/.mcp.json")));
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/.lsp.json")));
				const check = yield* build({ selection: nearest(root), targets: [], check: true });
				assert.isTrue(check.every((target) => target.plan.clean));
			}),
		);

		it.effect("a remote-only plugin gets no server library but still gets log.sh and host.sh", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({ "pluginfinity.config.ts": WITH_MCP, "package.json": PACKAGE_JSON });
				yield* build({ selection: nearest(root), targets: [], check: false });
				const manifest = JSON.parse(
					yield* fs.readFileString(path.join(root, "builds/claude/.claude-plugin/plugin.json")),
				);
				assert.deepStrictEqual(manifest.mcpServers.docs, { type: "http", url: "https://example.com/mcp" });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/lib/pluginfinity/server.sh")));
				assert.isTrue(yield* fs.exists(path.join(root, "builds/claude/lib/pluginfinity/log.sh")));
				assert.isTrue(yield* fs.exists(path.join(root, "builds/claude/lib/pluginfinity/host.sh")));
			}),
		);

		it.effect("a missing launcher is ShippedFileInvalid naming the server", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": WITH_SERVERS,
					"package.json": PACKAGE_JSON,
					"share/x": "",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				if (error._tag === "ShippedFileInvalid") {
					assert.strictEqual(error.problem, "missing");
					assert.strictEqual(error.referencedBy, "mcpServers.mcp");
				}
			}),
		);

		it.effect("a whole-command launcher without the exec bit is ShippedFileInvalid not-executable", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": SERVER_EXEC_COMMAND,
					"package.json": PACKAGE_JSON,
					"bin/serve": "#!/bin/sh\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				if (error._tag === "ShippedFileInvalid") assert.strictEqual(error.problem, "not-executable");
			}),
		);

		it.effect("a launcher named by both an MCP and an LSP server ships once with its mode", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": SERVER_SHARED_LAUNCHER,
					"package.json": PACKAGE_JSON,
					"bin/serve": "#!/bin/sh\n",
				});
				yield* fs.chmod(path.join(root, "bin/serve"), 0o755);
				const [claude] = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.deepStrictEqual(
					claude?.plan.added.filter((file) => file === "bin/serve"),
					["bin/serve"],
				);
				const mode = (yield* fs.stat(path.join(root, "builds/claude/bin/serve"))).mode & 0o777;
				assert.strictEqual(mode, 0o755);
			}),
		);

		for (const [label, fixture, file] of [
			["a . segment", SERVER_DOTTED, "bin/../bin/./start.sh"],
			["a .. segment that stays inside the plugin", SERVER_CLIMB_INSIDE, "a/../bin/start.sh"],
			["a .. segment that climbs out of the plugin", SERVER_ESCAPE, "a/../../escape.sh"],
		] as const) {
			it.effect(`a server path with ${label} is ShippedFileInvalid not-normal`, () =>
				Effect.gen(function* () {
					const root = yield* writeTree({
						"pluginfinity.config.ts": fixture,
						"package.json": PACKAGE_JSON,
						"bin/start.sh": "#!/bin/sh\n",
					});
					const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
					assert.strictEqual(error._tag, "ShippedFileInvalid");
					if (error._tag === "ShippedFileInvalid") {
						assert.strictEqual(error.problem, "not-normal");
						assert.strictEqual(error.file, file);
						assert.strictEqual(error.referencedBy, "mcpServers.mcp");
					}
				}),
			);
		}

		it.effect("a server launcher symlinked out of the plugin is ShippedFileInvalid outside-root", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const outside = yield* writeTree({ "start.sh": "#!/bin/sh\n" });
				const root = yield* writeTree({
					"pluginfinity.config.ts": SERVER_PLAIN,
					"package.json": PACKAGE_JSON,
				});
				yield* fs.makeDirectory(path.join(root, "bin"));
				yield* fs.symlink(path.join(outside, "start.sh"), path.join(root, "bin/start.sh"));
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				if (error._tag === "ShippedFileInvalid") {
					assert.strictEqual(error.problem, "outside-root");
					assert.strictEqual(error.file, "bin/start.sh");
				}
			}),
		);

		it.effect("a file under a listed directory symlinked out of the plugin is ShippedFileInvalid outside-root", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const outside = yield* writeTree({ secret: "secret\n" });
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_SHARE,
					"package.json": PACKAGE_JSON,
					"share/data.json": "{}\n",
				});
				yield* fs.symlink(path.join(outside, "secret"), path.join(root, "share/k"));
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				if (error._tag === "ShippedFileInvalid") {
					assert.strictEqual(error.problem, "outside-root");
					assert.strictEqual(error.file, "share/k");
					assert.strictEqual(error.referencedBy, "files");
				}
			}),
		);

		for (const [label, fixture, tree, shipped] of [
			[
				"a directory in an env value",
				SERVER_DIR_ENV,
				{ "share/data.json": "{}\n", "share/n/x.txt": "x\n" },
				["share/data.json", "share/n/x.txt"],
			],
			["a directory written with a trailing /", SERVER_DIR_SLASH, { "share/data.json": "{}\n" }, ["share/data.json"]],
			["a PATH-style list", SERVER_PATH_ENV, { "bin/tool": "#!/bin/sh\n" }, ["bin/tool"]],
		] as const) {
			it.effect(`a server naming ${label} ships the directory's files on both targets`, () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* writeTree({ "pluginfinity.config.ts": fixture, "package.json": PACKAGE_JSON, ...tree });
					yield* build({ selection: nearest(root), targets: [], check: false });
					for (const id of ["claude", "copilot"])
						for (const file of shipped)
							assert.isTrue(yield* fs.exists(path.join(root, "builds", id, file)), `${id} ${file}`);
					const check = yield* build({ selection: nearest(root), targets: [], check: true });
					assert.isTrue(check.every((target) => target.plan.clean));
				}),
			);
		}

		it.effect("a directory as a whole command is ShippedFileInvalid directory", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": SERVER_DIR_COMMAND,
					"package.json": PACKAGE_JSON,
					"bin/serve": "#!/bin/sh\n",
				});
				yield* fs.chmod(path.join(root, "bin"), 0o755);
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				if (error._tag === "ShippedFileInvalid") {
					assert.strictEqual(error.problem, "directory");
					assert.strictEqual(error.file, "bin");
					assert.strictEqual(error.referencedBy, "mcpServers.mcp");
					assert.include(error.message, "is a directory");
				}
			}),
		);

		it.effect("a file reference with a trailing / is ShippedFileInvalid missing", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": SERVER_FILE_SLASH,
					"package.json": PACKAGE_JSON,
					"bin/start.sh": "#!/bin/sh\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				if (error._tag === "ShippedFileInvalid") assert.strictEqual(error.problem, "missing");
			}),
		);

		it.effect("a file under a server-referenced directory symlinked out of the plugin is outside-root", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const outside = yield* writeTree({ secret: "secret\n" });
				const root = yield* writeTree({
					"pluginfinity.config.ts": SERVER_DIR_ENV,
					"package.json": PACKAGE_JSON,
					"share/data.json": "{}\n",
				});
				yield* fs.symlink(path.join(outside, "secret"), path.join(root, "share/k"));
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				if (error._tag === "ShippedFileInvalid") {
					assert.strictEqual(error.problem, "outside-root");
					assert.strictEqual(error.file, "share/k");
					assert.strictEqual(error.referencedBy, "mcpServers.mcp");
				}
			}),
		);

		it.effect("a host root spelling in a server is ComponentsInvalid on both targets", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": SERVER_HOST_SPELLING,
					"package.json": PACKAGE_JSON,
					"bin/start.sh": "#!/bin/sh\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ComponentsInvalid");
				if (error._tag !== "ComponentsInvalid") return;
				assert.deepStrictEqual(
					error.components.map((c) => (c._tag === "ComponentInvalid" ? [c.target, c.issues.map((i) => i.key)] : [])),
					[
						["claude", ["mcpServers.mcp.args"]],
						["copilot", ["mcpServers.mcp.args"]],
					],
				);
			}),
		);

		it.effect("a files entry naming builds/ is ConfigInvalid", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": FILES_BUILDS, "package.json": PACKAGE_JSON });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ConfigInvalid");
			}),
		);

		it.effect("a listed directory builds and then checks clean", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_SHARE,
					"package.json": PACKAGE_JSON,
					"share/data.json": "{}\n",
				});
				const [claude] = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.include(claude?.plan.added ?? [], "share/data.json");
				const check = yield* build({ selection: nearest(root), targets: [], check: true });
				assert.isTrue(check.every((target) => target.plan.clean));
			}),
		);

		it.effect("a target's own files ship to that target only, on top of the base files", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_PER_TARGET,
					"package.json": PACKAGE_JSON,
					"share/data.json": "{}\n",
					"copilot-only/x": "x\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isTrue(yield* fs.exists(path.join(root, "builds/copilot/copilot-only/x")));
				assert.isTrue(yield* fs.exists(path.join(root, "builds/copilot/share/data.json")));
				assert.isTrue(yield* fs.exists(path.join(root, "builds/claude/share/data.json")));
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/copilot-only/x")));
			}),
		);

		it.effect("a missing target files entry is ShippedFileInvalid naming the target's files", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_PER_TARGET_MISSING,
					"package.json": PACKAGE_JSON,
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				if (error._tag === "ShippedFileInvalid") assert.strictEqual(error.referencedBy, "copilot.files");
			}),
		);

		it.effect("a missing files entry is ShippedFileInvalid naming files", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": FILES_MISSING, "package.json": PACKAGE_JSON });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ShippedFileInvalid");
				// The CLI reports a finding (exit 1) only for what isBuildError recognises.
				assert.isTrue(isBuildError(error));
				if (error._tag === "ShippedFileInvalid") assert.strictEqual(error.referencedBy, "files");
			}),
		);

		it.effect("a files entry reaching into lib/pluginfinity/ is PathConflict", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_RESERVED,
					"package.json": PACKAGE_JSON,
					"lib/pluginfinity/server.sh": "",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.strictEqual(error.file, "lib/pluginfinity/server.sh");
				assert.strictEqual(error.conflict, "reserved-dir");
				assert.include(error.message, "reserves for its injected library");
				assert.include(error.remediation.hint, "Move lib/pluginfinity/server.sh");
			}),
		);

		it.effect("a files entry landing on a generated server file is PathConflict", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_COLLIDE,
					"package.json": PACKAGE_JSON,
					"mcp.json": "{}\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.strictEqual(error.file, "mcp.json");
				assert.strictEqual(error.conflict, "generated");
				assert.include(error.message, "copilot generates mcp.json");
				assert.include(error.remediation.hint, "pluginfinity writes that file itself");
			}),
		);

		for (const file of [".mcp.json", ".lsp.json"] as const) {
			it.effect(`a ${file} that would ship to Claude, beside its inline servers, is PathConflict`, () =>
				Effect.gen(function* () {
					const root = yield* writeTree({
						"pluginfinity.config.ts": FILES_SHADOW(file, "claude: true,", SHADOW_SERVERS[file]),
						"package.json": PACKAGE_JSON,
						[file]: "{}\n",
					});
					const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
					assert.strictEqual(error._tag, "PathConflict");
					if (error._tag !== "PathConflict") return;
					assert.strictEqual(error.target, "claude");
					assert.strictEqual(error.file, file);
					assert.strictEqual(error.conflict, "reserved-server-file");
					assert.include(error.message, `claude loads ${file} as a server config file`);
					assert.include(error.remediation.hint, "mcpServers or lspServers");
					assert.notInclude(error.remediation.hint, "writes that file itself");
				}),
			);

			it.effect(`a ${file} ships to Claude when the plugin has no inline servers of that kind`, () =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* writeTree({
						"pluginfinity.config.ts": FILES_SHADOW(file, "claude: true,"),
						"package.json": PACKAGE_JSON,
						[file]: "{}\n",
					});
					yield* build({ selection: nearest(root), targets: [], check: false });
					assert.isTrue(yield* fs.exists(path.join(root, "builds/claude", file)));
				}),
			);
		}

		it.effect("a .mcp.json a server names is PathConflict on Claude", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_SHADOW_SERVER,
					"package.json": PACKAGE_JSON,
					"bin/start-mcp.sh": "#!/bin/sh\n",
					".mcp.json": "{}\n",
				});
				yield* fs.chmod(path.join(root, "bin/start-mcp.sh"), 0o755);
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag === "PathConflict") assert.strictEqual(error.file, ".mcp.json");
			}),
		);

		it.effect("a .mcp.json listed in files ships to Copilot, whose servers are in files", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_SHADOW(".mcp.json", "copilot: true,"),
					"package.json": PACKAGE_JSON,
					".mcp.json": "{}\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isTrue(yield* fs.exists(path.join(root, "builds/copilot/.mcp.json")));
			}),
		);

		it.effect("a launcher both server-referenced and under a files directory ships once", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": FILES_OVERLAP,
					"package.json": PACKAGE_JSON,
					"bin/start-mcp.sh": "#!/bin/sh\n",
				});
				const [claude] = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.deepStrictEqual(
					claude?.plan.added.filter((file) => file === "bin/start-mcp.sh"),
					["bin/start-mcp.sh"],
				);
				assert.isTrue(yield* fs.exists(path.join(root, "builds/claude/bin/start-mcp.sh")));
			}),
		);

		it.effect("an unresolved LSP field on Copilot is collected in ComponentsInvalid", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({ "pluginfinity.config.ts": LSP_UNRESOLVED, "package.json": PACKAGE_JSON });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ComponentsInvalid");
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
		it.effect("hook_has lists a skill or agent only on the hosts that build it", () =>
			Effect.gen(function* () {
				const root = yield* hookedPlugin(HOOKED, {
					"skills/everyone/SKILL.md": "---\ndescription: x\n---\nBody.\n",
					"skills/claude-only/SKILL.md": "---\ndescription: x\ntargets:\n  copilot: false\n---\nBody.\n",
					"agents/everyone.md": "---\nname: everyone\ndescription: x\n---\n",
					"agents/claude-helper.md": "---\nname: claude-helper\ndescription: x\ntargets:\n  copilot: false\n---\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const claude = yield* fs.readFileString(path.join(root, "builds/claude/hooks/lib/pluginfinity/tools.sh"));
				const copilot = yield* fs.readFileString(path.join(root, "builds/copilot/hooks/lib/pluginfinity/tools.sh"));
				assert.include(claude, "_PF_HAS_SKILLS='claude-only everyone'");
				assert.include(claude, "_PF_HAS_AGENTS='claude-helper everyone'");
				assert.include(copilot, "_PF_HAS_SKILLS='everyone'");
				assert.include(copilot, "_PF_HAS_AGENTS='everyone'");
			}),
		);

		it.effect("each target gets its hooks file, its own scripts and the shared helpers, not the other's script", () =>
			Effect.gen(function* () {
				const root = yield* hookedPlugin();
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				const lib = (target: string) =>
					hookLibFiles(target as "claude" | "copilot", "hooked", ENGINE_VERSION, "").map((file) => file.path);
				assert.deepStrictEqual(
					builds.map((entry) => [entry.target, entry.plan.added]),
					[
						[
							"claude",
							[
								".claude-plugin/plugin.json",
								"hooks/hooks.json",
								...lib("claude"),
								"hooks/lib/output.sh",
								"hooks/start.sh",
								"lib/pluginfinity/host.sh",
								"lib/pluginfinity/log.sh",
							].sort(),
						],
						[
							"copilot",
							[
								"com.github.copilot/hooks/hooks.json",
								...lib("copilot"),
								"hooks/lib/output.sh",
								"hooks/start.copilot.sh",
								"lib/pluginfinity/host.sh",
								"lib/pluginfinity/log.sh",
								"plugin.json",
							].sort(),
						],
					],
				);
			}),
		);

		it.effect("build --check stays clean when a generated hook library file turns executable on disk", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				for (const file of hookLibFiles("claude", "hooked", ENGINE_VERSION, "")) {
					yield* fs.chmod(path.join(root, "builds/claude", file.path), 0o755);
				}
				const check = yield* build({ selection: nearest(root), targets: [], check: true });
				assert.isTrue(check.every((entry) => entry.plan.clean));
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
				assert.strictEqual(error.component, "hooks");
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

		it.effect("under exec, a script path with = is HookScriptInvalid equals-in-path", () =>
			Effect.gen(function* () {
				const root = yield* hookedPlugin(HOOKED_EXEC.replaceAll("hooks/start.sh", "hooks/a=b.sh"), {
					"hooks/a=b.sh": "#!/usr/bin/env bash\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "HookScriptInvalid");
				if (error._tag !== "HookScriptInvalid") return;
				assert.deepStrictEqual([error.script, error.problem], ["hooks/a=b.sh", "equals-in-path"]);
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

		it.effect("a file a command hook names after the root ships, and a missing one is HookScriptInvalid", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin(HOOKED_COMMAND, { "scripts/stop.sh": "echo stop\n" });
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isTrue(yield* fs.exists(path.join(root, "builds/claude/scripts/stop.sh")));
				yield* fs.remove(path.join(root, "scripts/stop.sh"));
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "HookScriptInvalid");
			}),
		);

		it.effect("operating-system clutter in hooks/ never ships", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin(HOOKED, { "hooks/.DS_Store": "junk", "hooks/start.sh~": "backup" });
				yield* build({ selection: nearest(root), targets: ["claude"], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/hooks/.DS_Store")));
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/hooks/start.sh~")));
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

		it.effect("host.sh in each build names its host and the plugin", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const claude = yield* fs.readFileString(path.join(root, "builds/claude/hooks/lib/pluginfinity/host.sh"));
				const copilot = yield* fs.readFileString(path.join(root, "builds/copilot/hooks/lib/pluginfinity/host.sh"));
				assert.include(claude, "PLUGINFINITY_HOST=claude\nPLUGINFINITY_PLUGIN='hooked'\n");
				assert.include(copilot, "PLUGINFINITY_HOST=copilot\n");
			}),
		);

		it.effect("a plugin without hooks gets no library", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* plugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/hooks")));
				assert.isFalse(yield* fs.exists(path.join(root, "builds/copilot/hooks")));
			}),
		);

		it.effect("a source file under hooks/lib/pluginfinity/ is a PathConflict", () =>
			Effect.gen(function* () {
				const root = yield* hookedPlugin(HOOKED, { "hooks/lib/pluginfinity/mine.sh": "echo mine\n" });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.strictEqual(error.file, "hooks/lib/pluginfinity/mine.sh");
				assert.strictEqual(error.target, "claude");
			}),
		);

		it.effect("a source file at exactly hooks/lib/pluginfinity is a PathConflict", () =>
			Effect.gen(function* () {
				const root = yield* hookedPlugin(HOOKED, { "hooks/lib/pluginfinity": "not a directory\n" });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.deepStrictEqual([error.target, error.file], ["claude", "hooks/lib/pluginfinity"]);
			}),
		);

		it.effect("a plugin whose every hook is fallback omit gets no library", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin(
					`export default {
	name: "hooked",
	description: "Fixture plugin.",
	hooks: { Setup: [{ script: "hooks/start.sh", fallback: "omit" }] },
	copilot: true,
};\n`,
				);
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/copilot/hooks/lib/pluginfinity")));
				assert.isFalse(yield* fs.exists(path.join(root, "builds/copilot/hooks/hooks.json")));
			}),
		);

		it.effect("--check reports a stale injected library as drift", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* hookedPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				yield* fs.writeFileString(path.join(root, "builds/claude/hooks/lib/pluginfinity/hook.sh"), "# old\n");
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: true }));
				assert.strictEqual(error._tag, "BuildStale");
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

	/** The one component problem a build reports. */
	const failure = (root: string) =>
		Effect.flip(build({ selection: nearest(root), targets: [], check: false })).pipe(
			Effect.map((error) => {
				if (error._tag !== "ComponentsInvalid") throw new Error(`expected ComponentsInvalid, got ${error._tag}`);
				assert.strictEqual(error.components.length, 1);
				return error.components[0] as (typeof error.components)[number];
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

		it.effect("a skill's references/*.md gets its tokens and pluginfinity links rendered per target", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/references/guide.md":
						"Use {{tool Read}}. See [x](pluginfinity://skill/beta/references/x.md) and {{skill beta}}.\n",
					"skills/beta/SKILL.md": "---\ndescription: Does beta.\n---\nBeta.\n",
					"skills/beta/references/x.md": "X.\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.strictEqual(
					yield* read(root, "builds/claude/skills/alpha/references/guide.md"),
					`Use Read. See [x](\${CLAUDE_PLUGIN_ROOT}/skills/beta/references/x.md) and /valid-claude:beta.\n`,
				);
				assert.strictEqual(
					yield* read(root, "builds/copilot/skills/alpha/references/guide.md"),
					"Use view. See x (the `beta` skill's `references/x.md`) and /valid-plugin:beta.\n",
				);
			}),
		);

		it.effect("{{plugin_root}} in a Copilot body fails the build naming the file, the target and the line", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": "---\ndescription: Does alpha.\n---\n\nRun {{plugin_root}}/bin/x.\n",
				});
				yield* build({ selection: nearest(root), targets: ["claude"], check: false });
				assert.include(yield* read(root, "builds/claude/skills/alpha/SKILL.md"), `Run \${CLAUDE_PLUGIN_ROOT}/bin/x.`);
				const error = yield* failure(root);
				assert.match(error.path, /skills\/alpha\/SKILL\.md$/);
				assert.strictEqual(error.target, "copilot");
				assert.strictEqual(error.issues[0]?.key, "line 5");
				assert.include(error.issues[0]?.message, "{{plugin_root}}");
			}),
		);

		it.effect("a token inside a claude-only host block builds clean on both targets", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": [
						"---",
						"description: Does alpha.",
						"---",
						"<!-- pluginfinity:only claude -->",
						"Run {{plugin_root}}/bin/x.",
						"<!-- /pluginfinity:only -->",
						"Always.",
						"",
					].join("\n"),
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.include(yield* read(root, "builds/claude/skills/alpha/SKILL.md"), `Run \${CLAUDE_PLUGIN_ROOT}/bin/x.`);
				assert.notInclude(yield* read(root, "builds/copilot/skills/alpha/SKILL.md"), "plugin_root");
			}),
		);

		it.effect("a token problem below or inside a host block reports its source line", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": [
						"---",
						"description: Does alpha.",
						"---",
						"<!-- pluginfinity:only claude -->",
						"Claude only.",
						"<!-- /pluginfinity:only -->",
						"{{plugin_root}}",
						"<!-- pluginfinity:only copilot -->",
						"Copilot only.",
						"{{tool TodoWrite}}",
						"<!-- /pluginfinity:only -->",
						"",
					].join("\n"),
					"skills/alpha/references/guide.md": [
						"<!-- pluginfinity:only claude -->",
						"Claude only.",
						"<!-- /pluginfinity:only -->",
						"{{tool TodoWrite}}",
						"",
					].join("\n"),
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: ["copilot"], check: false }));
				if (error._tag !== "ComponentsInvalid") throw new Error(`expected ComponentsInvalid, got ${error._tag}`);
				assert.deepStrictEqual(
					error.components.map((component) => [
						component.path.split("/skills/")[1],
						component.issues.map((found) => found.key),
					]),
					[
						["alpha/SKILL.md", ["line 7", "line 10"]],
						["alpha/references/guide.md", ["line 4"]],
					],
				);
			}),
		);

		it.effect("a link to a skill a target leaves out fails on that target only", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/references/guide.md": "See [beta](pluginfinity://skill/beta).\n",
					"skills/beta/SKILL.md": "---\ndescription: Does beta.\ntargets:\n  copilot: false\n---\nBeta.\n",
				});
				yield* build({ selection: nearest(root), targets: ["claude"], check: false });
				const error = yield* failure(root);
				assert.strictEqual(error.target, "copilot");
				assert.include(error.issues[0]?.message, 'no skill "beta"');
			}),
		);

		it.effect("token problems in SKILL.md and a reference file are each reported on their own file", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": "---\ndescription: Does alpha.\n---\n{{plugin_root}}\n",
					"skills/alpha/references/guide.md": "ok\n\n{{tool TodoWrite}} [g](pluginfinity://skill/ghost)\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: ["copilot"], check: false }));
				if (error._tag !== "ComponentsInvalid") throw new Error(`expected ComponentsInvalid, got ${error._tag}`);
				assert.deepStrictEqual(
					error.components.map((component) => [
						component.path.split("/skills/")[1],
						component.target,
						component.issues.map((found) => found.key),
					]),
					[
						["alpha/SKILL.md", "copilot", ["line 4"]],
						["alpha/references/guide.md", "copilot", ["line 3", "line 3"]],
					],
				);
			}),
		);

		it.effect("a CRLF skill builds with LF line endings throughout", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": "---\r\ndescription: Does alpha.\r\n---\r\n\r\nBody.\r\n",
					"skills/alpha/references/guide.md": "Guide.\r\n",
				});
				yield* build({ selection: nearest(root), targets: ["claude"], check: false });
				assert.notInclude(yield* read(root, "builds/claude/skills/alpha/SKILL.md"), "\r");
				assert.strictEqual(yield* read(root, "builds/claude/skills/alpha/references/guide.md"), "Guide.\n");
			}),
		);

		it.effect("clutter in a skill directory never ships", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* skillPlugin({ "skills/alpha/.DS_Store": "junk" });
				yield* build({ selection: nearest(root), targets: ["claude"], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/claude/skills/alpha/.DS_Store")));
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

		it.effect("every broken skill in the plugin is reported by one build", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": "---\ndescription: x\ncolour: red\n---\n",
					"skills/beta/SKILL.md": "---\nname: gamma\ndescription: x\n---\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ComponentsInvalid");
				if (error._tag !== "ComponentsInvalid") return;
				assert.deepStrictEqual(
					error.components.map((component) => component.issues.map((found) => found.key)),
					[["colour"], ["name"]],
				);
				assert.include(error.message, "2 components are invalid");
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

		it.effect("a plain value holding a YAML comment is ComponentInvalid, not silently cut short", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": "---\ndescription: x\nwhen_to_use: parsing refs (Closes #12) from a message\n---\n",
				});
				const error = yield* failure(root);
				assert.strictEqual(error.issues[0]?.key, "line 3");
				assert.include(error.message, "reads as a comment");
			}),
		);

		it.effect("a cut-short value is caught at any depth: in a targets block and in a list", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": [
						"---",
						"description: x",
						"allowed-tools:",
						"  - Read # the reader",
						"targets:",
						"  copilot:",
						"    description: Parses refs (Closes #12) from a commit message",
						"---",
						"",
					].join("\n"),
				});
				const error = yield* failure(root);
				assert.deepStrictEqual(
					error.issues.map((found) => found.key),
					["line 4", "line 7"],
				);
				assert.include(error.message, "the plain value of description");
				assert.include(error.message, "a list item");
			}),
		);

		it.effect("a # inside a block scalar is text, at any depth", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md": [
						"---",
						"description: >-",
						"  Parses refs (Closes #12)",
						"  note: see #3 too",
						"targets:",
						"  copilot:",
						"    description: |",
						"      Copilot (Closes #12)",
						"---",
						"",
					].join("\n"),
				});
				yield* build({ selection: nearest(root), targets: ["copilot"], check: false });
				assert.include(yield* read(root, "builds/copilot/skills/alpha/SKILL.md"), "Copilot (Closes #12)");
			}),
		);

		it.effect("a quoted value or a comment line is not mistaken for a cut-short value", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md":
						'---\n# a comment line\ndescription: "Closes #12 safely"\nwhen_to_use: >-\n  folded #12\n---\n',
				});
				yield* build({ selection: nearest(root), targets: ["claude"], check: false });
				assert.include(yield* read(root, "builds/claude/skills/alpha/SKILL.md"), "Closes #12 safely");
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

		it.effect("a mistyped override in a targets block is reported under targets.<id>", () =>
			Effect.gen(function* () {
				const root = yield* skillPlugin({
					"skills/alpha/SKILL.md":
						"---\ndescription: x\ntargets:\n  claude:\n    effort: bogus\n  copilot:\n    description: ''\n---\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ComponentsInvalid");
				if (error._tag !== "ComponentsInvalid") return;
				assert.deepStrictEqual(
					error.components.map((component) => [component.target, component.issues.map((found) => found.key)]),
					[
						["claude", ["targets.claude.effort"]],
						["copilot", ["targets.copilot.description"]],
					],
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

describe("build with agents", () => {
	const AGENT = [
		"---",
		"name: helper",
		"description: Helps.",
		"tools:",
		"  - Read",
		"  - Write",
		"  - Edit",
		"  - Bash",
		"  - Skill",
		"  - ToolSearch",
		"  - mcp__docs__search",
		"  - mcp__plugin_other_server__run",
		"skills:",
		"  - alpha",
		"model: inherit",
		"color: blue",
		"---",
		"",
		"You help.",
		"",
	].join("\n");

	const agentPlugin = (files: Readonly<Record<string, string>> = {}) =>
		writeTree({
			"pluginfinity.config.ts": VALID,
			"package.json": PACKAGE_JSON,
			"agents/helper.md": AGENT,
			...files,
		});

	const read = (root: string, file: string) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			return yield* fs.readFileString(path.join(root, file));
		});

	layer(NodeServices.layer)((it) => {
		it.effect("claude gets the agent as written, under agents/<name>.md", () =>
			Effect.gen(function* () {
				const root = yield* agentPlugin();
				yield* build({ selection: nearest(root), targets: ["claude"], check: false });
				assert.strictEqual(yield* read(root, "builds/claude/agents/helper.md"), AGENT);
			}),
		);

		it.effect(
			"copilot gets aliased tools, its MCP spelling, no Claude-only tools, no inherit model or color, and skills as a section",
			() =>
				Effect.gen(function* () {
					const root = yield* agentPlugin();
					yield* build({ selection: nearest(root), targets: ["copilot"], check: false });
					assert.strictEqual(
						yield* read(root, "builds/copilot/com.github.copilot/agents/helper.agent.md"),
						[
							"---",
							"name: helper",
							"description: Helps.",
							"tools:",
							"  - read",
							"  - edit",
							"  - execute",
							"  - docs/search",
							"---",
							"",
							"You help.",
							"",
							"## Skills",
							"",
							"- alpha",
							"",
						].join("\n"),
					);
				}),
		);

		it.effect(
			"frontmatter a target keeps whole is written as the author wrote it; one it changes is re-serialized",
			() =>
				Effect.gen(function* () {
					const source =
						"---\nname: helper\n# why it exists\ndescription: >\n  Folded\n  text.\ncolor: blue\n---\nBody.\n";
					const root = yield* agentPlugin({ "agents/helper.md": source });
					yield* build({ selection: nearest(root), targets: [], check: false });
					assert.strictEqual(yield* read(root, "builds/claude/agents/helper.md"), source);
					assert.notInclude(
						yield* read(root, "builds/copilot/com.github.copilot/agents/helper.agent.md"),
						"# why it exists",
					);
				}),
		);

		it.effect("an agent body renders an {{agent}} token as the agent id under each target's plugin name", () =>
			Effect.gen(function* () {
				const root = yield* agentPlugin({
					"agents/helper.md": "---\nname: helper\ndescription: Helps.\n---\nHand off to {{agent other}}.\n",
					"agents/other.md": "---\nname: other\ndescription: Other.\n---\nOther.\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.include(yield* read(root, "builds/claude/agents/helper.md"), "Hand off to valid-claude:other.");
				assert.include(
					yield* read(root, "builds/copilot/com.github.copilot/agents/helper.agent.md"),
					"Hand off to valid-plugin:other.",
				);
			}),
		);

		it.effect("an agent body token problem names the agent file, the target and the file line", () =>
			Effect.gen(function* () {
				const root = yield* agentPlugin({
					"agents/helper.md": "---\nname: helper\ndescription: Helps.\n---\n\nUse {{tool TodoWrite}}.\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				if (error._tag !== "ComponentsInvalid") throw new Error(`expected ComponentsInvalid, got ${error._tag}`);
				assert.deepStrictEqual(
					error.components.map((component) => [component.target, component.issues.map((found) => found.key)]),
					[["copilot", ["line 6"]]],
				);
				assert.match(error.components[0]?.path ?? "", /agents\/helper\.md$/);
			}),
		);

		it.effect("a token problem's remediation points at host blocks and the escape, not a targets block", () =>
			Effect.gen(function* () {
				const root = yield* agentPlugin({
					"agents/helper.md": "---\nname: helper\ndescription: Helps.\n---\n\nUse {{tool TodoWrite}}.\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				if (error._tag !== "ComponentsInvalid") throw new Error(`expected ComponentsInvalid, got ${error._tag}`);
				const [component] = error.components;
				assert.deepStrictEqual(
					component?.issues.map((found) => found.kind),
					["token"],
				);
				const hint = component?.remediation.hint ?? "";
				assert.include(hint, "<!-- pluginfinity:only claude -->");
				assert.include(hint, "\\{{");
				assert.notInclude(hint, "targets.copilot");
				assert.include(error.remediation.hint, "<!-- pluginfinity:only claude -->");
			}),
		);

		it.effect("an agent token problem below a host block reports its source line", () =>
			Effect.gen(function* () {
				const root = yield* agentPlugin({
					"agents/helper.md": [
						"---",
						"name: helper",
						"description: Helps.",
						"---",
						"<!-- pluginfinity:only claude -->",
						"Claude only.",
						"<!-- /pluginfinity:only -->",
						"Use {{tool TodoWrite}}.",
						"",
					].join("\n"),
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: ["copilot"], check: false }));
				if (error._tag !== "ComponentsInvalid") throw new Error(`expected ComponentsInvalid, got ${error._tag}`);
				assert.deepStrictEqual(
					error.components.map((component) => component.issues.map((found) => found.key)),
					[["line 8"]],
				);
			}),
		);

		it.effect("an agent whose name differs from its file is reported", () =>
			Effect.gen(function* () {
				const root = yield* agentPlugin({ "agents/helper.md": "---\nname: other\ndescription: x\n---\n" });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ComponentsInvalid");
				assert.include(error.message, `must equal the file name "helper"`);
			}),
		);

		it.effect("mcpServers is unresolved on copilot, reported for copilot only", () =>
			Effect.gen(function* () {
				const root = yield* agentPlugin({
					"agents/helper.md": "---\nname: helper\ndescription: x\nmcpServers:\n  - docs\n---\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "ComponentsInvalid");
				if (error._tag !== "ComponentsInvalid") return;
				assert.deepStrictEqual(
					error.components.map((component) => [component.target, component.issues[0]?.key]),
					[["copilot", "mcpServers"]],
				);
			}),
		);

		it.effect("targets.copilot: false leaves the agent out of the Copilot build", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* agentPlugin({
					"agents/helper.md": "---\nname: helper\ndescription: x\ntargets:\n  copilot: false\n---\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/copilot/com.github.copilot/agents")));
				assert.isTrue(yield* fs.exists(path.join(root, "builds/claude/agents/helper.md")));
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

describe("build notes", () => {
	/** A plugin whose agent, skill, hooks and LSP server each lose something on Copilot. */
	const notedPlugin = () =>
		writeTree({
			"pluginfinity.config.ts": NOTED,
			"package.json": PACKAGE_JSON,
			"hooks/setup.sh": "#!/bin/bash\n",
			"hooks/start.sh": "#!/bin/bash\n",
			"hooks/guard.sh": '#!/bin/bash\nhook_system_message "careful"\n',
			"agents/x.md": NOTED_AGENT,
			"skills/s/SKILL.md": NOTED_SKILL,
			"skills/plain/SKILL.md": PLAIN_SKILL,
		});

	const EXPECTED: ReadonlyArray<BuildNote> = [
		{ target: "copilot", path: "agents/x.md", kind: "dropped", name: "color" },
		{ target: "copilot", path: "agents/x.md", kind: "dropped", name: "maxTurns" },
		{ target: "copilot", path: "hooks/guard.sh", kind: "hook-output-ignored", name: "PreToolUse:hook_system_message" },
		{ target: "copilot", path: "skills/s/SKILL.md", kind: "degraded", name: "paths" },
		{ target: "copilot", path: "skills/s/SKILL.md", kind: "tool-dropped", name: "ToolSearch" },
		{ target: "copilot", path: "config", kind: "dropped", name: "lspServers.md.diagnostics" },
		{ target: "copilot", path: "config", kind: "hook-matcher-runtime", name: "SessionStart" },
		{ target: "copilot", path: "config", kind: "hook-omitted", name: "Setup" },
		{
			target: "copilot",
			path: "config",
			kind: "hook-matcher-widened",
			name: "SessionStart startup -> startup|new",
		},
	];

	layer(NodeServices.layer)((it) => {
		it.effect("each target's build carries its notes, sorted by component, then kind, then name", () =>
			Effect.gen(function* () {
				const root = yield* notedPlugin();
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.deepStrictEqual(
					builds.map((one) => [one.target, one.notes]),
					[
						["claude", []],
						["copilot", EXPECTED],
					],
				);
			}),
		);

		it.effect("build --check returns the same notes as a write", () =>
			Effect.gen(function* () {
				const root = yield* notedPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const builds = yield* build({ selection: nearest(root), targets: ["copilot"], check: true });
				assert.deepStrictEqual(builds[0]?.notes, EXPECTED);
			}),
		);

		it.effect("the hook scripts a target ships do not depend on which targets are selected", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* notedPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/copilot/hooks/setup.sh")));
				yield* build({ selection: nearest(root), targets: ["copilot"], check: true });
				yield* build({ selection: nearest(root), targets: ["copilot"], check: false });
				assert.isFalse(yield* fs.exists(path.join(root, "builds/copilot/hooks/setup.sh")));
			}),
		);

		it.effect("validate reports the same notes", () =>
			Effect.gen(function* () {
				const root = yield* notedPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const validations = yield* validate({ selection: nearest(root), targets: ["copilot"], skipHosts: true });
				assert.deepStrictEqual(validations[0]?.notes, EXPECTED);
			}),
		);
	});
});

describe("build with a plugin's own MCP tools", () => {
	layer(NodeServices.layer)((it) => {
		it.effect(
			"copilot translates tools of servers it declares under the Claude name, and drops one declared only on Claude",
			() =>
				Effect.gen(function* () {
					const fs = yield* FileSystem.FileSystem;
					const path = yield* Path.Path;
					const root = yield* writeTree({
						"pluginfinity.config.ts": OWN_MCP,
						"package.json": PACKAGE_JSON,
						"agents/x.md": OWN_MCP_AGENT,
					});
					const builds = yield* build({ selection: nearest(root), targets: [], check: false });
					const copilot = yield* fs.readFileString(
						path.join(root, "builds/copilot/com.github.copilot/agents/x.agent.md"),
					);
					assert.include(copilot, "tools:\n  - mcp/describe\n");
					assert.notInclude(copilot, "only");
					assert.deepStrictEqual(builds.find((one) => one.target === "copilot")?.notes, [
						{ target: "copilot", path: "agents/x.md", kind: "tool-dropped", name: "mcp__plugin_okfit_cl__only" },
					]);
					const claude = yield* fs.readFileString(path.join(root, "builds/claude/agents/x.md"));
					assert.include(claude, "mcp__plugin_okfit_mcp__describe");
					assert.include(claude, "mcp__plugin_okfit_cl__only");
					assert.deepStrictEqual(builds.find((one) => one.target === "claude")?.notes, []);
				}),
		);

		it.effect("names agent ids and skill commands by each target's own plugin name, own MCP tools by Claude's", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* writeTree({
					"pluginfinity.config.ts": OWN_MCP.replace("copilot: true", 'copilot: { name: "x" }'),
					"package.json": PACKAGE_JSON,
					"agents/a.md":
						"---\nname: a\ndescription: Does a.\n---\n\n{{agent a}} {{skill k}} {{tool mcp__plugin_okfit_mcp__describe}}\n",
					"skills/k/SKILL.md": "---\nname: k\ndescription: Does k.\n---\n\nBody.\n",
				});
				yield* build({ selection: nearest(root), targets: [], check: false });
				const copilot = yield* fs.readFileString(
					path.join(root, "builds/copilot/com.github.copilot/agents/a.agent.md"),
				);
				assert.include(copilot, "x:a /x:k mcp-describe");
				const claude = yield* fs.readFileString(path.join(root, "builds/claude/agents/a.md"));
				assert.include(claude, "okfit:a /okfit:k mcp__plugin_okfit_mcp__describe");
			}),
		);
	});
});

describe("build with monitors", () => {
	const monitoredPlugin = (config: string = MONITORED, extra: Readonly<Record<string, string>> = {}) =>
		writeTree({
			"pluginfinity.config.ts": config,
			"package.json": PACKAGE_JSON,
			"hooks/mail.sh": "#!/usr/bin/env bash\n",
			"monitors/issues.mjs": "",
			...extra,
		});

	layer(NodeServices.layer)((it) => {
		it.effect("Claude gets monitors.json, the monitor files and monitor.sh's slot; Copilot gets none of them", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* monitoredPlugin();
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				const claude = builds.find((one) => one.target === "claude");
				const copilot = builds.find((one) => one.target === "copilot");
				assert.include(claude?.plan.added ?? [], "monitors/monitors.json");
				assert.include(claude?.plan.added ?? [], "hooks/mail.sh");
				assert.include(claude?.plan.added ?? [], "monitors/issues.mjs");
				assert.include(claude?.plan.added ?? [], "lib/pluginfinity/monitor.sh");
				assert.isFalse(copilot?.plan.added.includes("lib/pluginfinity/monitor.sh"));
				// A monitor script under hooks/ does not ride the hooks directory to a target without monitors.
				assert.isFalse(copilot?.plan.added.some((file) => file.startsWith("monitors/") || file === "hooks/mail.sh"));
				assert.deepStrictEqual(
					copilot?.notes.map((note) => [note.kind, note.name]),
					[
						["monitor-omitted", "dogfood-mail"],
						["monitor-omitted", "issues"],
					],
				);
				assert.isFalse(yield* fs.exists(path.join(root, "builds/copilot/monitors")));
				assert.deepStrictEqual(claude?.notes, []);
			}),
		);

		it.effect("a missing monitor script is HookScriptInvalid naming monitors", () =>
			Effect.gen(function* () {
				const root = yield* monitoredPlugin(MONITORED_MISSING);
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "HookScriptInvalid");
				if (error._tag !== "HookScriptInvalid") return;
				assert.deepStrictEqual([error.script, error.problem], ["monitors/missing.sh", "missing"]);
				assert.strictEqual(error.component, "monitors");
			}),
		);

		it.effect("a missing file a command monitor names is HookScriptInvalid", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* monitoredPlugin();
				yield* fs.remove(path.join(root, "monitors/issues.mjs"));
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "HookScriptInvalid");
				if (error._tag !== "HookScriptInvalid") return;
				assert.strictEqual(error.script, "monitors/issues.mjs");
				assert.strictEqual(error.component, "monitors");
			}),
		);

		it.effect("under exec, a monitor script path with = builds", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* monitoredPlugin(MONITORED_EXEC_EQUALS, { "monitors/a=b.sh": "#!/usr/bin/env bash\n" });
				yield* fs.chmod(path.join(root, "monitors/a=b.sh"), 0o755);
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.include(builds[0]?.plan.added ?? [], "monitors/a=b.sh");
			}),
		);

		it.effect("a source monitors/monitors.json is PathConflict generated on Claude", () =>
			Effect.gen(function* () {
				const root = yield* monitoredPlugin(MONITORED_COLLIDE, {
					"monitors/mail.sh": "#!/usr/bin/env bash\n",
					"monitors/monitors.json": "[]\n",
				});
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.deepStrictEqual([error.file, error.conflict], ["monitors/monitors.json", "reserved-monitors-file"]);
			}),
		);

		it.effect("a source monitors/monitors.json fails the build even when no files entry ships it", () =>
			Effect.gen(function* () {
				const root = yield* monitoredPlugin(MONITORED, { "monitors/monitors.json": "[]\n" });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.deepStrictEqual(
					[error.target, error.file, error.conflict],
					["claude", "monitors/monitors.json", "reserved-monitors-file"],
				);
				assert.include(error.remediation.hint, "monitors");
			}),
		);

		it.effect("a source monitors/monitors.json fails the build when files ships the directory", () =>
			Effect.gen(function* () {
				const config = MONITORED.replace("claude: true,", 'files: ["monitors/"],\n\tclaude: true,');
				const root = yield* monitoredPlugin(config, { "monitors/monitors.json": "[]\n" });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.strictEqual(error.conflict, "reserved-monitors-file");
			}),
		);

		it.effect("monitors set only in a target override still reject a source monitors/monitors.json", () =>
			Effect.gen(function* () {
				const config = `export default {
	name: "monitored",
	description: "Fixture plugin.",
	claude: { monitors: { mail: { script: "hooks/mail.sh", description: "Mail." } } },
	copilot: true,
};\n`;
				const root = yield* monitoredPlugin(config, { "monitors/monitors.json": "[]\n" });
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "PathConflict");
				if (error._tag !== "PathConflict") return;
				assert.deepStrictEqual([error.target, error.conflict], ["claude", "reserved-monitors-file"]);
			}),
		);

		it.effect("without a monitors field, a shipped monitors/monitors.json still builds", () =>
			Effect.gen(function* () {
				const config = `export default {
	name: "monitored",
	description: "Fixture plugin.",
	files: ["monitors/"],
	claude: true,
};\n`;
				const root = yield* monitoredPlugin(config, { "monitors/monitors.json": "[]\n" });
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.include(builds[0]?.plan.added ?? [], "monitors/monitors.json");
			}),
		);

		it.effect("Copilot builds no monitors, so a source monitors/monitors.json is not a failure there", () =>
			Effect.gen(function* () {
				const config = `export default {
	name: "monitored",
	description: "Fixture plugin.",
	monitors: { mail: { script: "hooks/mail.sh", description: "Mail." } },
	copilot: true,
};\n`;
				const root = yield* monitoredPlugin(config, { "monitors/monitors.json": "[]\n" });
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				assert.deepStrictEqual(
					builds.map((one) => one.target),
					["copilot"],
				);
			}),
		);
	});
});

describe("build with a skill-bound monitor", () => {
	const skillMonitorPlugin = (config: string, skillFrontmatter = "") =>
		writeTree({
			"pluginfinity.config.ts": config,
			"package.json": PACKAGE_JSON,
			"monitors/watch.sh": "#!/usr/bin/env bash\n",
			"skills/hello/SKILL.md": `---\ndescription: Say hello.\n${skillFrontmatter}---\nBody.\n`,
		});
	interface Located {
		readonly target: string;
		readonly issues: ReadonlyArray<{ readonly key: string }>;
	}
	const issueKeys = (error: { readonly _tag: string }) => {
		const parts: ReadonlyArray<Located> =
			error._tag === "ComponentsInvalid"
				? (error as unknown as { readonly components: ReadonlyArray<Located> }).components
				: [error as unknown as Located];
		return parts.map((part) => [part.target, part.issues.map((found) => found.key)]);
	};

	layer(NodeServices.layer)((it) => {
		it.effect("a skill the Claude target excludes fails the Claude build, naming monitors.<name>.when", () =>
			Effect.gen(function* () {
				const root = yield* skillMonitorPlugin(MONITOR_SKILL, "targets:\n  claude: false\n");
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.deepStrictEqual(issueKeys(error), [["claude", ["monitors.watch.when"]]]);
				// Copilot builds no monitors, so the same skill-less monitor does not fail it.
				const copilot = yield* build({ selection: nearest(root), targets: ["copilot"], check: false });
				assert.deepStrictEqual(
					copilot[0]?.notes.map((note) => note.kind),
					["monitor-omitted"],
				);
			}),
		);

		it.effect("an unknown skill fails the build", () =>
			Effect.gen(function* () {
				const root = yield* skillMonitorPlugin(MONITOR_SKILL_UNKNOWN);
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.deepStrictEqual(issueKeys(error), [["claude", ["monitors.watch.when"]]]);
			}),
		);

		it.effect("a renamed Claude target qualifies the skill with its own name", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* skillMonitorPlugin(MONITOR_SKILL_RENAMED);
				yield* build({ selection: nearest(root), targets: [], check: false });
				const written = JSON.parse(yield* fs.readFileString(path.join(root, "builds/claude/monitors/monitors.json")));
				assert.strictEqual(written[0].when, "on-skill-invoke:other:hello");
			}),
		);
	});
});

describe("build with session env", () => {
	const envedPlugin = (config: string = ENVED) =>
		writeTree({
			"pluginfinity.config.ts": config,
			"package.json": PACKAGE_JSON,
			"hooks/start.sh": "#!/usr/bin/env bash\n",
			"hooks/stop.sh": "#!/usr/bin/env bash\n",
			"scripts/env-setup.sh": "echo FX_A=x\n",
		});
	const readJson = (root: string, file: string) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			return JSON.parse(yield* fs.readFileString(path.join(root, file)));
		});

	layer(NodeServices.layer)((it) => {
		it.effect("Claude runs the env runner first among the SessionStart entries", () =>
			Effect.gen(function* () {
				const root = yield* envedPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const hooks = (yield* readJson(root, "builds/claude/hooks/hooks.json")).hooks;
				assert.deepStrictEqual(hooks.SessionStart[0], {
					hooks: [
						{
							type: "command",
							command: `export PLUGINFINITY_EVENT='SessionStart'; sh "\${CLAUDE_PLUGIN_ROOT}/lib/pluginfinity/env-run.sh"`,
							timeout: 15,
						},
					],
				});
				assert.strictEqual(hooks.SessionStart.length, 2);
				assert.include(hooks.SessionStart[1].hooks[0].args, `\${CLAUDE_PLUGIN_ROOT}/hooks/start.sh`);
				assert.strictEqual(hooks.Stop.length, 1);
			}),
		);

		it.effect("Copilot runs the env runner first among the SessionStart entries", () =>
			Effect.gen(function* () {
				const root = yield* envedPlugin();
				yield* build({ selection: nearest(root), targets: [], check: false });
				const hooks = (yield* readJson(root, "builds/copilot/com.github.copilot/hooks/hooks.json")).hooks;
				assert.deepStrictEqual(hooks.SessionStart[0], {
					type: "command",
					bash: `sh "\${PLUGIN_ROOT}/lib/pluginfinity/env-run.sh"`,
					timeoutSec: 15,
					env: { PLUGINFINITY_EVENT: "SessionStart" },
				});
				assert.strictEqual(hooks.SessionStart.length, 2);
			}),
		);

		it.effect("every target gets env.sh with its declarations, env-run.sh and the setup script", () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const root = yield* envedPlugin();
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				for (const one of builds) {
					assert.include(one.plan.added, "lib/pluginfinity/env.sh");
					assert.include(one.plan.added, "lib/pluginfinity/env-run.sh");
					assert.include(one.plan.added, "scripts/env-setup.sh");
					const lib = yield* fs.readFileString(path.join(one.out, "lib/pluginfinity/env.sh"));
					assert.include(
						lib,
						[
							"_pf_env_names='FX_A FX_B'",
							"_pf_env_default_FX_A='it'\\''s'",
							"_pf_env_default_FX_B=''",
							"_pf_env_setup='scripts/env-setup.sh'",
							"_pf_env_setup_timeout=10",
							"# <<< pluginfinity env declarations",
						].join("\n"),
					);
				}
			}),
		);

		it.effect("Copilot notes env-shell-unsupported; Claude notes nothing", () =>
			Effect.gen(function* () {
				const root = yield* envedPlugin();
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				const notes = (id: string) => builds.find((one) => one.target === id)?.notes;
				assert.deepStrictEqual(notes("copilot"), [
					{ target: "copilot", path: "config", kind: "env-shell-unsupported", name: "env" },
				]);
				assert.deepStrictEqual(notes("claude"), []);
			}),
		);

		it.effect("notes a SessionStart hook whose timeout is under the runner wait, on both targets", () =>
			Effect.gen(function* () {
				const root = yield* envedPlugin(ENVED_SHORT_TIMEOUT);
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				for (const id of ["claude", "copilot"]) {
					const notes = builds
						.find((one) => one.target === id)
						?.notes.filter((note) => note.kind === "env-wait-timeout");
					assert.deepStrictEqual(notes, [
						{ target: id, path: "hooks/start.sh", kind: "env-wait-timeout", name: "SessionStart" },
					]);
				}
			}),
		);

		it.effect("a SessionStart timeout of 5 or more, or none, gets no env-wait-timeout note", () =>
			Effect.gen(function* () {
				const root = yield* envedPlugin();
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				for (const one of builds) assert.isFalse(one.notes.some((note) => note.kind === "env-wait-timeout"));
			}),
		);

		it.effect("env with no hooks adds the runner alone, and no hook library", () =>
			Effect.gen(function* () {
				const root = yield* envedPlugin(ENVED_NO_HOOKS);
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				const claude = (yield* readJson(root, "builds/claude/hooks/hooks.json")).hooks;
				assert.deepStrictEqual(Object.keys(claude), ["SessionStart"]);
				assert.strictEqual(claude.SessionStart.length, 1);
				const copilot = (yield* readJson(root, "builds/copilot/com.github.copilot/hooks/hooks.json")).hooks;
				assert.deepStrictEqual(Object.keys(copilot), ["SessionStart"]);
				for (const one of builds) {
					assert.isFalse(one.plan.added.some((file) => file.startsWith("hooks/lib/")));
					assert.include(one.plan.added, "lib/pluginfinity/env.sh");
				}
			}),
		);

		it.effect("a target override that removes SessionStart hooks keeps the runner", () =>
			Effect.gen(function* () {
				const root = yield* envedPlugin(ENVED_OVERRIDDEN);
				yield* build({ selection: nearest(root), targets: [], check: false });
				const hooks = (yield* readJson(root, "builds/claude/hooks/hooks.json")).hooks;
				assert.strictEqual(hooks.SessionStart.length, 1);
				assert.include(hooks.SessionStart[0].hooks[0].command, "lib/pluginfinity/env-run.sh");
			}),
		);

		it.effect("a missing setup script is HookScriptInvalid naming env", () =>
			Effect.gen(function* () {
				const root = yield* envedPlugin(ENVED_SETUP_MISSING);
				const error = yield* Effect.flip(build({ selection: nearest(root), targets: [], check: false }));
				assert.strictEqual(error._tag, "HookScriptInvalid");
				if (error._tag !== "HookScriptInvalid") return;
				assert.deepStrictEqual(
					[error.script, error.problem, error.component],
					["scripts/missing.sh", "missing", "env"],
				);
				assert.include(error.message, "env setup script scripts/missing.sh named in");
			}),
		);

		it.effect("no env block: no env library, no runner entry, no note", () =>
			Effect.gen(function* () {
				const root = yield* writeTree({
					"pluginfinity.config.ts": HOOKED,
					"package.json": PACKAGE_JSON,
					"hooks/start.sh": "",
					"hooks/start.copilot.sh": "",
				});
				const builds = yield* build({ selection: nearest(root), targets: [], check: false });
				for (const one of builds) {
					assert.isFalse(one.plan.added.some((file) => file.includes("env.sh") || file.includes("env-run.sh")));
					assert.isFalse(one.notes.some((note) => note.kind === "env-shell-unsupported"));
				}
				const hooks = (yield* readJson(root, "builds/claude/hooks/hooks.json")).hooks;
				assert.strictEqual(hooks.SessionStart.length, 1);
				assert.notInclude(JSON.stringify(hooks), "env-run.sh");
			}),
		);
	});
});
