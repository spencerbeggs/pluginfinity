import type { ToolDiscoveryShape } from "@effected/commands";
import { ResolvedTool, ToolDiscovery, ToolNotFoundError } from "@effected/commands";
import type { Layer } from "effect";
import { Effect, Option } from "effect";

/** How a fake tool answers: a version string, found with no parseable version, absent, or never. */
export type FakeTool = string | "unparseable" | "missing" | "hang";

/**
 * A `ToolDiscovery` double answering from `table`; a tool the table does not
 * name is missing.
 */
export const fakeTools = (table: Readonly<Record<string, FakeTool>>): Layer.Layer<ToolDiscovery> => {
	const resolve: ToolDiscoveryShape["resolve"] = (tool) => {
		const entry = table[tool.name] ?? "missing";
		if (entry === "missing") return Effect.fail(new ToolNotFoundError({ tool: tool.name, searched: ["global"] }));
		if (entry === "hang") return Effect.never;
		const version = entry === "unparseable" ? Option.none<string>() : Option.some(entry);
		return Effect.succeed(
			ResolvedTool.make({
				name: tool.name,
				source: "global",
				version,
				globalVersion: version,
				localVersion: Option.none(),
				mismatch: false,
			}),
		);
	};
	return ToolDiscovery.layerTest({ resolve });
};
