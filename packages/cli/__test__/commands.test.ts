import { NodeServices } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import { Effect } from "effect";
import { BOTH_TARGETS, ONLY_COPILOT } from "./fixtures/configs.js";
import { runCli } from "./utils/run.js";
import { writeTree } from "./utils/tree.js";

const FLAGS: ReadonlyArray<readonly [args: ReadonlyArray<string>, flags: ReadonlyArray<string>]> = [
	[["init"], ["--layout", "--name", "--pm", "--target", "--no-changesets", "--no-ci", "--yes"]],
	[
		["plugin", "add"],
		["--target", "--dir"],
	],
	[["build"], ["--target", "--all", "--check", "--config"]],
	[["validate"], ["--target", "--all", "--config", "--no-host"]],
	[["doctor"], ["--all", "--config", "--strict"]],
];

describe("every command's help", () => {
	for (const [args, flags] of FLAGS) {
		it.effect(`${args.join(" ")} --help lists ${flags.join(" ")}`, () =>
			Effect.gen(function* () {
				const result = yield* runCli([...args, "--help"]);
				assert.strictEqual(result.code, 0);
				const help = result.stdout.join("\n");
				for (const flag of flags) assert.include(help, flag);
			}),
		);
	}

	it.effect("a bare plugin group prints its help and exits 0", () =>
		Effect.gen(function* () {
			const result = yield* runCli(["plugin"]);
			assert.strictEqual(result.code, 0);
			assert.include(result.stdout.join("\n"), "add");
		}),
	);
});

describe("usage errors exit 64", () => {
	const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
		["an unknown --target id", ["build", "--target", "vscode"]],
		["an unknown --layout", ["init", "--layout", "flat"]],
		["an unknown --pm", ["init", "--pm", "deno"]],
		["build --config with --all", ["build", "--config", "pluginfinity.config.ts", "--all"]],
		["validate --config with --all", ["validate", "--config", "pluginfinity.config.ts", "--all"]],
		["doctor --config with --all", ["doctor", "--config", "pluginfinity.config.ts", "--all"]],
		["init --name that is not kebab-case", ["init", "--name", "My Plugin"]],
		["plugin add with a name that is not kebab-case", ["plugin", "add", "My_Plugin"]],
		["plugin add with no name", ["plugin", "add"]],
	];
	for (const [label, args] of cases) {
		it.effect(label, () =>
			Effect.gen(function* () {
				const result = yield* runCli(args);
				assert.strictEqual(result.code, 64);
			}),
		);
	}
});

describe("stubs stop with NotImplemented (exit 1)", () => {
	const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
		["init with defaults", ["init"]],
		[
			"init with every flag",
			[
				"init",
				"site",
				"--layout",
				"plugins",
				"--name",
				"my-plugin",
				"--pm",
				"bun",
				"--target",
				"claude",
				"--target",
				"copilot",
				"--no-changesets",
				"--no-ci",
				"--yes",
			],
		],
		["plugin add", ["plugin", "add", "my-plugin", "--target", "claude", "--dir", "plugins/mine"]],
	];
	for (const [label, args] of cases) {
		it.effect(label, () =>
			Effect.gen(function* () {
				const result = yield* runCli(args);
				assert.strictEqual(result.code, 1);
				assert.isTrue(result.stderr.some((line) => line.includes("NotImplemented")));
			}),
		);
	}
});

describe("build and validate run the front half", () => {
	layer(NodeServices.layer)((it) => {
		it.effect("build with a valid config reaches NotImplemented", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["build", "--target", "claude", "--check"], { cwd });
				assert.strictEqual(result.code, 1);
				assert.isTrue(result.stderr.some((line) => line.includes("pluginfinity build is not implemented yet")));
			}),
		);

		it.effect("validate --no-host with a valid config reaches NotImplemented", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["validate", "--no-host"], { cwd });
				assert.strictEqual(result.code, 1);
				assert.isTrue(result.stderr.some((line) => line.includes("pluginfinity validate is not implemented yet")));
			}),
		);

		it.effect("[path] is resolved against the launch directory", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "plugins/a/pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["build", "plugins/a"], { cwd });
				assert.isTrue(result.stderr.some((line) => line.includes("not implemented yet")));
			}),
		);

		it.effect("no config is a finding for people: message and remediation on stderr, exit 1", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "README.md": "" });
				const result = yield* runCli(["build"], { cwd });
				assert.strictEqual(result.code, 1);
				assert.deepStrictEqual(result.stdout, []);
				assert.include(result.stderr[0] ?? "", "no pluginfinity.config");
				assert.include(result.stderr[1] ?? "", "--config");
			}),
		);

		it.effect("no config is one JSON object on stdout for an agent, exit 1", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "README.md": "" });
				const result = yield* runCli(["build", "--agent"], { cwd });
				assert.strictEqual(result.code, 1);
				assert.strictEqual(result.stdout.length, 1);
				const report = JSON.parse(result.stdout[0] ?? "");
				assert.strictEqual(report.ok, false);
				assert.strictEqual(report.error.tag, "ConfigNotFound");
				assert.isString(report.error.remediation.hint);
			}),
		);

		it.effect("a --target the config does not enable is a finding naming the config file", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": ONLY_COPILOT });
				const result = yield* runCli(["validate", "--target", "claude"], { cwd });
				assert.strictEqual(result.code, 1);
				assert.include(result.stderr[0] ?? "", `${cwd}/pluginfinity.config.ts does not enable target "claude"`);
			}),
		);

		it.effect("a [path] that does not exist is a usage error, not a walk to a config above it", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["build", "no-such-dir"], { cwd });
				assert.strictEqual(result.code, 64);
			}),
		);

		it.effect("a --config file that does not exist says so, with a hint to check the path", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "README.md": "" });
				const result = yield* runCli(["build", "--config", "nope.ts", "--human"], { cwd });
				assert.strictEqual(result.code, 1);
				assert.deepStrictEqual(result.stdout, []);
				assert.include(result.stderr[0] ?? "", `config file ${cwd}/nope.ts does not exist`);
				assert.include(result.stderr[1] ?? "", "Check the path");
				assert.notInclude(result.stderr.join("\n"), "name the file with --config");
			}),
		);

		it.effect("a relative --config resolves against the launch directory", () =>
			Effect.gen(function* () {
				const cwd = yield* writeTree({ "plugins/a/pluginfinity.config.ts": BOTH_TARGETS });
				const result = yield* runCli(["build", "--config", "plugins/a/pluginfinity.config.ts"], { cwd });
				assert.strictEqual(result.code, 1);
				assert.isTrue(result.stderr.some((line) => line.includes("pluginfinity build is not implemented yet")));
			}),
		);
	});
});
