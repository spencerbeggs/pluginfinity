import { CurrentDistribution } from "@effected/engine";
import { Audience } from "@effected/env";
import { ENGINE_VERSION, validate } from "@pluginfinity/engine";
import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { validateJson, validateLines } from "../render/build.js";
import { reportFindings } from "../render/config-error.js";
import type { LaunchFacts } from "./shared.js";
import { allFlag, configFlag, pathArgument, targetFlag, toSelection } from "./shared.js";

/** `pluginfinity validate [path]`: pluginfinity's own checks, then each host's CLI. */
export const validateCommand = (launch: LaunchFacts) =>
	Command.make(
		"validate",
		{
			path: pathArgument,
			target: targetFlag,
			all: allFlag,
			config: configFlag,
			noHost: Flag.Boolean("no-host").pipe(Flag.withDefault(false), Flag.withDescription("skip the host CLIs")),
		},
		(input) =>
			Effect.gen(function* () {
				const selection = yield* toSelection(launch, input);
				const validations = yield* validate({ selection, targets: input.target, skipHosts: input.noHost });
				const audience = yield* Audience;
				if (audience.kind === "human") {
					for (const line of validateLines(validations)) yield* Console.log(line);
				} else {
					const distribution = yield* CurrentDistribution;
					yield* Console.log(
						JSON.stringify({
							engine_version: ENGINE_VERSION,
							distribution: Option.getOrNull(distribution),
							ok: true,
							validations: validations.map(validateJson),
						}),
					);
				}
			}).pipe(reportFindings),
	).pipe(Command.withDescription("Run pluginfinity's own checks, then each host's CLI"));
