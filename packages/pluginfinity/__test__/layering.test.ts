import { assert, describe, layer } from "@effect/vitest";
import { LayerEdge, LayerPolicy, WorkspaceLayering } from "@effected/workspaces/testing";
import { Effect } from "effect";
import { POLICY_PATH, WorkspaceLive } from "./utils/workspace.js";

describe("workspace layering", () => {
	layer(WorkspaceLive, { excludeTestServices: true })((it) => {
		it.effect("every workspace dependency edge points down the committed layers", () =>
			Effect.gen(function* () {
				const policy = yield* LayerPolicy.load(POLICY_PATH);
				const report = yield* WorkspaceLayering.checkWorkspace(policy);
				assert.deepStrictEqual(report.violations, []);
				// Non-vacuity: the check looked at real edges, not an empty graph.
				assert.isAbove(report.edgeCount, 0);
			}),
		);

		// Positive control: the same policy rejects an upward edge, so the clean
		// report above comes from the policy discriminating, not from it passing
		// everything.
		it.effect("the policy flags core depending on the CLI as upward", () =>
			Effect.gen(function* () {
				const policy = yield* LayerPolicy.load(POLICY_PATH);
				const upward = LayerEdge.make({
					from: "@pluginfinity/core",
					to: "@pluginfinity/cli",
					field: "devDependencies",
				});
				const report = WorkspaceLayering.check(
					{ names: ["@pluginfinity/cli", "@pluginfinity/core"], edges: [upward] },
					policy,
				);
				assert.deepStrictEqual(
					report.offenders.map(({ edge, reason }) => [edge.label, reason]),
					[[upward.label, "upward"]],
				);
			}),
		);
	});
});
