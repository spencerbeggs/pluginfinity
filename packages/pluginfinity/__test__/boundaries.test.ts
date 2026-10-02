import { builtinModules } from "node:module";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import type { Offence } from "@effected/workspaces/testing";
import { SourceBoundary } from "@effected/workspaces/testing";
import { Effect } from "effect";
import { VERSION_DEFINE, packageSrc } from "./utils/workspace.js";

const labels = (offences: ReadonlyArray<Offence>): ReadonlyArray<string> =>
	offences.map((offence) => `${offence.file} ${offence.rule}`);

// Platform-free layers: no process, no Node built-in in either spelling
// (`node:*` alone misses a bare `"fs"`), no Effect platform package.
const PLATFORM_FREE = [
	"process",
	"node:process",
	{ forbidImports: ["node:*", ...builtinModules, "@effect/platform*"] },
	VERSION_DEFINE,
] as const;

// The CLI in either spelling: the package root or any subpath of it.
const NO_CLI = { forbidImports: ["@pluginfinity/cli", "@pluginfinity/cli/*"] } as const;

describe("source boundaries", () => {
	// Positive control: the scanner still flags what it must and spares what it
	// must, so a clean scan below is a real result.
	it("the boundary scanner passes its shipped fixtures", () => {
		assert.deepStrictEqual(SourceBoundary.verifyFixtures(), []);
	});

	layer(NodeServices.layer)((it) => {
		for (const dir of ["core", "targets"]) {
			it.effect(`@pluginfinity/${dir} is platform-free`, () =>
				Effect.gen(function* () {
					const scan = yield* SourceBoundary.scan({
						root: packageSrc(dir),
						rules: PLATFORM_FREE,
						allowRules: { forbidTokens: ["version.ts"] },
					});
					assert.isNotEmpty(scan.files);
					assert.deepStrictEqual(scan.violations, []);
					assert.deepStrictEqual(labels(scan.waived), ["version.ts forbidTokens"]);
				}),
			);
		}

		it.effect("@pluginfinity/engine never reads process", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: packageSrc("engine"),
					rules: ["process", "node:process", VERSION_DEFINE],
					allowRules: { forbidTokens: ["version.ts"] },
				});
				assert.isNotEmpty(scan.files);
				assert.deepStrictEqual(scan.violations, []);
				assert.deepStrictEqual(labels(scan.waived), ["version.ts forbidTokens"]);
			}),
		);

		it.effect("@pluginfinity/cli reads process only in main.ts", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: packageSrc("cli"),
					rules: ["process", "node:process", VERSION_DEFINE],
					allowRules: { process: ["main.ts"], forbidTokens: ["version.ts"] },
				});
				assert.isNotEmpty(scan.files);
				assert.deepStrictEqual(scan.violations, []);
				assert.deepStrictEqual([...new Set(labels(scan.waived))], ["main.ts process", "version.ts forbidTokens"]);
			}),
		);

		it.effect("the pluginfinity carrier never reads process", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: packageSrc("pluginfinity"),
					rules: ["process", "node:process", VERSION_DEFINE],
					allowRules: { forbidTokens: ["version.ts"] },
				});
				assert.isNotEmpty(scan.files);
				assert.deepStrictEqual(scan.violations, []);
				assert.deepStrictEqual(labels(scan.waived), ["version.ts forbidTokens"]);
			}),
		);
		// The library entry is the config surface alone; only the bin may pull in
		// the CLI, so `import "pluginfinity"` in a config never loads the command tree.
		it.effect("the carrier's library entry never imports @pluginfinity/cli", () =>
			Effect.gen(function* () {
				const scan = yield* SourceBoundary.scan({
					root: packageSrc("pluginfinity"),
					rules: [NO_CLI],
					allow: ["bin/**"],
				});
				assert.include(scan.files, "index.ts");
				assert.deepStrictEqual(scan.allowed, ["bin/pluginfinity.ts"]);
				assert.deepStrictEqual(scan.violations, []);
				// Control: without the bin exemption the same rule flags the bin's import.
				const all = yield* SourceBoundary.scan({ root: packageSrc("pluginfinity"), rules: [NO_CLI] });
				assert.deepStrictEqual(labels(all.offences), ["bin/pluginfinity.ts forbidImports"]);
			}),
		);
	});
});
