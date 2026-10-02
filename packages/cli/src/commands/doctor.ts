import { CliExit } from "@effected/cli";
import { Audience } from "@effected/env";
import { runDoctor } from "@pluginfinity/engine";
import { Console, Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { doctorJson, doctorLines } from "../render/doctor.js";
import type { LaunchFacts } from "./shared.js";
import { allFlag, configFlag, pathArgument, toSelection } from "./shared.js";

/** `pluginfinity doctor [path]`: report on the environment. */
export const doctorCommand = (launch: LaunchFacts) =>
	Command.make(
		"doctor",
		{
			path: pathArgument,
			all: allFlag,
			config: configFlag,
			strict: Flag.Boolean("strict").pipe(
				Flag.withDefault(false),
				Flag.withDescription("exit 1 when a required check fails"),
			),
		},
		(input) =>
			Effect.gen(function* () {
				const selection = yield* toSelection(launch, input);
				const report = yield* runDoctor({ selection, nodeVersion: launch.nodeVersion });
				const audience = yield* Audience;
				if (audience.kind === "human") {
					for (const line of doctorLines(report)) yield* Console.log(line);
				} else {
					yield* Console.log(doctorJson(report));
				}
				// Reporting is doctor's job: it exits 0 unless --strict asks for a gate.
				if (input.strict && !report.ok) yield* CliExit.set(1);
			}),
	).pipe(Command.withDescription("Report on the environment: runtime, host CLIs, tools and the config"));
