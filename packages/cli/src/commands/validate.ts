import { isConfigError, validate } from "@pluginfinity/engine";
import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { reportConfigError } from "../render/config-error.js";
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
				yield* validate({ selection, targets: input.target, skipHosts: input.noHost }).pipe(
					Effect.catchIf(isConfigError, reportConfigError),
				);
			}),
	).pipe(Command.withDescription("Run pluginfinity's own checks, then each host's CLI"));
