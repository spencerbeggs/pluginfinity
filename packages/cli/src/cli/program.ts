// The runnable program short of the runtime: the command tree and argument
// parsing over injected process values. `main.ts` adds the platform, the
// environment services, failure reporting and `runMain`; tests run the same
// `program` under `CliRuntime.main` with a test platform.

import type { CliExit } from "@effected/cli";
import { CliAudience } from "@effected/cli";
import type { ToolDiscovery } from "@effected/commands";
import type { Audience } from "@effected/env";
import type { NotImplemented } from "@pluginfinity/engine";
import type { Effect, PlatformError } from "effect";
import type { CliError } from "effect/cli";
import { Command } from "effect/cli";
import { buildCommand } from "../commands/build.js";
import { doctorCommand } from "../commands/doctor.js";
import { initCommand } from "../commands/init.js";
import { logsCommand } from "../commands/logs.js";
import { pluginCommand } from "../commands/plugin.js";
import type { LaunchFacts } from "../commands/shared.js";
import { validateCommand } from "../commands/validate.js";

/**
 * The process values the program runs against, read once in `main.ts`.
 *
 * @public
 */
export interface ProgramDeps extends LaunchFacts {
	/** The version `--version` prints. */
	readonly version: string;
}

// The root command: no handler, so a bare invocation prints help; core
// supplies `--help`, `--version` and `--log-level`.
const root = (launch: LaunchFacts) =>
	Command.make("pluginfinity").pipe(
		Command.withDescription("Build one agent-plugin source into per-host plugin outputs (Claude Code, GitHub Copilot)"),
		Command.withSharedFlags(CliAudience.flags()),
		Command.withSubcommands([
			initCommand,
			pluginCommand,
			buildCommand(launch),
			validateCommand(launch),
			doctorCommand(launch),
			logsCommand(launch),
		]),
	);

/**
 * Parse `args` and run the selected command, with the audience flags
 * resolved before core parses.
 *
 * @remarks
 * The return type is spelled out because TypeScript cannot name the inferred
 * `Audience` requirement through `@effected/cli` alone (TS2883).
 *
 * @public
 */
export const program = (
	args: ReadonlyArray<string>,
	deps: ProgramDeps,
): Effect.Effect<
	void,
	CliError.CliError | NotImplemented | PlatformError.PlatformError,
	Audience | CliExit | ToolDiscovery | Command.Environment
> => CliAudience.runWith(root(deps), { version: deps.version })(args);
