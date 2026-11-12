import { assert, describe, it } from "@effect/vitest";
import {
	INSTALLED_PACKAGE_DIRS,
	TOOL_PACKAGE_DIRS,
	effectFamilyDependencies,
	packageDir,
	peerClosure,
	readManifest,
	unpinnedDependencies,
} from "./utils/closure.js";

// pluginfinity is a tool: it runs beside a host's own Effect and kit, sharing
// no service, schema or brand with it. Its published closure is sealed by
// pinning every Effect-family dependency exactly, so a kit patch never reaches
// an installed pluginfinity without a pluginfinity release, and no kit
// library inside it can bind a peer from another release line.
describe("tool closure", () => {
	it("every tool package pins its Effect-family dependencies with catalog:effected:exact", () => {
		const manifests = TOOL_PACKAGE_DIRS.map((dir) => readManifest(packageDir(dir)));
		assert.deepStrictEqual(manifests.flatMap(unpinnedDependencies), []);
		// Non-vacuity: every tool package has Effect-family dependencies to check.
		for (const manifest of manifests) assert.isAbove(effectFamilyDependencies(manifest).length, 0, manifest.name);
	});

	// Positive control: the same check rejects the caret-publishing spelling.
	it("flags a kit dependency written catalog:effected", () => {
		const offenders = unpinnedDependencies({
			name: "fixture",
			dependencies: { "@effected/kit": "catalog:effected", effect: "catalog:effected:exact", jiti: "^2.6.1" },
		});
		assert.deepStrictEqual(offenders, ["fixture: @effected/kit@catalog:effected"]);
	});

	for (const dir of INSTALLED_PACKAGE_DIRS) {
		it(`${dir} declares every required peer of its installed closure`, () => {
			const report = peerClosure(packageDir(dir));
			assert.deepStrictEqual(report.unresolved, []);
			assert.deepStrictEqual(report.missing, []);
			// Non-vacuity: the walk reached the workspace layers and the kit below them.
			assert.isAbove(report.visited, 10);
		});
	}

	// Positive control: the engine takes effect as a peer instead of declaring
	// it, so walking from the engine must report the kit's effect peer missing.
	it("reports an undeclared peer when walking from a package that leaves it to its installer", () => {
		const report = peerClosure(packageDir("engine"));
		assert.isTrue(
			report.missing.some((line) => line.startsWith("effect <- ")),
			report.missing.join("\n"),
		);
	});
});
