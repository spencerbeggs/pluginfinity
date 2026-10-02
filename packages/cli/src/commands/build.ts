import { build, isConfigError } from "@pluginfinity/engine";
import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { reportConfigError } from "../render/config-error.js";
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
				yield* build({ selection, targets: input.target, check: input.check }).pipe(
					Effect.catchIf(isConfigError, reportConfigError),
				);
			}),
	).pipe(Command.withDescription("Regenerate builds/<id>/ from source"));
