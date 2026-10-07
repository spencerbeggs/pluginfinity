// The assembled program over an injected platform: the command tree under
// `CliRuntime.main`, with the `--version` line naming the distribution read
// from `CurrentDistribution`. `main.ts` runs it on Node; tests run the same
// assembly over a test platform, so the wiring they check is the shipped one.

import { CliRuntime } from "@effected/cli";
import type { ToolDiscovery } from "@effected/commands";
import type { Distribution } from "@effected/engine";
import { CurrentDistribution, distributionSuffix } from "@effected/engine";
import { ToolDiscoveryLive } from "@pluginfinity/engine";
import type { Layer } from "effect";
import { Effect } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { ProgramDeps } from "./program.js";
import { program } from "./program.js";

/**
 * Options for `main`.
 *
 * @public
 */
export interface MainOptions {
	/**
	 * The package the bin was installed through, passed by a carrier's shim.
	 * Absent for a direct run, which prints no `via` suffix.
	 */
	readonly distribution?: Distribution | undefined;
}

/**
 * The process-derived inputs `run` takes besides the arguments.
 */
export interface RunOptions<RP, EP> extends ProgramDeps {
	/** The platform layer: `NodeServices.layer` in production. */
	readonly platform: Layer.Layer<RP, EP>;
	/** The real stderr terminal check; `Stdio` reports only stdout's. */
	readonly stderrIsTerminal?: Effect.Effect<boolean> | undefined;
	/** How `doctor` finds tools; `ToolDiscoveryLive` over the platform when absent. */
	readonly tools?: Layer.Layer<ToolDiscovery, never, ChildProcessSpawner.ChildProcessSpawner> | undefined;
}

/**
 * Run `args` through the program under `CliRuntime.main`.
 *
 * @remarks
 * Reads `CurrentDistribution`, a reference that defaults to none, so a caller
 * provides it only for a carrier launch.
 */
export const run = <RP, EP>(args: ReadonlyArray<string>, options: RunOptions<RP, EP>) =>
	Effect.gen(function* () {
		const distribution = yield* CurrentDistribution;
		const deps = {
			version: options.version,
			cwd: options.cwd,
			nodeVersion: options.nodeVersion,
			stateHome: options.stateHome,
		};
		return yield* CliRuntime.main(program(args, deps).pipe(Effect.provide(options.tools ?? ToolDiscoveryLive)), {
			platform: options.platform,
			// A usage error's help goes to stderr beside the errors, so stdout
			// carries only structured output for agents and CI; `--help` stays on stdout.
			helpOnUsageError: "stderr",
			env: {
				audienceEnvVar: "PLUGINFINITY_AUDIENCE",
				...(options.stderrIsTerminal === undefined ? {} : { stderrIsTerminal: options.stderrIsTerminal }),
				log: { envVar: "PLUGINFINITY_LOG_LEVEL", argv: args },
				formatter: {
					formatVersion: (name, version) => `${name} v${version}${distributionSuffix(distribution)}`,
				},
			},
		});
	});
