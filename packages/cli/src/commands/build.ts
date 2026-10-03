import { CurrentDistribution } from "@effected/engine";
import { Audience } from "@effected/env";
import { ENGINE_VERSION, build } from "@pluginfinity/engine";
import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { buildJson, buildLines } from "../render/build.js";
import { reportFindings } from "../render/config-error.js";
import type { LaunchFacts } from "./shared.js";
import { allFlag, configFlag, pathArgument, targetFlag, toSelection } from "./shared.js";

/** `pluginfinity build [path]`: regenerate `builds/<id>/` from source. */
export const buildCommand = (launch: LaunchFacts) =>
	Command.make(
		"build",
		{
			path: pathArgument,
			target: targetFlag,
			all: allFlag,
			check: Flag.Boolean("check").pipe(
				Flag.withDefault(false),
				Flag.withDescription("rebuild in memory, compare with builds/, fail on any difference"),
			),
			config: configFlag,
		},
		(input) =>
			Effect.gen(function* () {
				const selection = yield* toSelection(launch, input);
				const builds = yield* build({ selection, targets: input.target, check: input.check });
				const audience = yield* Audience;
				if (audience.kind === "human") {
					for (const line of buildLines(builds, input.check)) yield* Console.log(line);
				} else {
					const distribution = yield* CurrentDistribution;
					yield* Console.log(
						JSON.stringify({
							engine_version: ENGINE_VERSION,
							distribution: Option.getOrNull(distribution),
							ok: true,
							builds: builds.map(buildJson),
						}),
					);
				}
			}).pipe(reportFindings),
	).pipe(Command.withDescription("Regenerate builds/<id>/ from source"));
