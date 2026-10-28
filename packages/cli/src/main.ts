// The assembled pluginfinity program on Node. Owns the process: the only file in
// this package that reads `process`. Exported as `./main`, never from `.`.

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Cause, Effect, Exit, Runtime } from "effect";
import type { MainOptions } from "./cli/run.js";
import { run } from "./cli/run.js";
import { CurrentFollow, DEFAULT_FOLLOW } from "./commands/logs.js";
import { ShellStateXdg, stateHome } from "./state-home.js";
import { CLI_VERSION } from "./version.js";

export type { MainOptions } from "./cli/run.js";

// `NodeRuntime.runMain` exits the process only for a non-zero code, so a live
// handle a user's config leaves behind (jiti evaluates it in-process) would keep
// a successful run alive after its output. Exit with every code once stdout has
// flushed, so piped JSON is never cut short.
//
// An interrupt (Ctrl-C) ends `logs --follow` as it ends `tail -f`: exit 0, not 130.
// `following` is set by the follow itself, so every other command keeps 130.
const exitAfterFlush =
	(following: () => boolean) =>
	(exit: Exit.Exit<unknown, unknown>, onExit: (code: number) => void): void =>
		Runtime.defaultTeardown(
			following() && !Exit.isSuccess(exit) && Cause.hasInterruptsOnly(exit.cause) ? Exit.void : exit,
			(code) => {
				process.stdout.write("", () => {
					onExit(code);
					process.exit(code);
				});
			},
		);

/**
 * Run pluginfinity against this process's arguments and streams.
 *
 * @param options - the distribution a carrier's shim passes; omitted for a direct run
 *
 * @public
 */
export const main = (options: MainOptions = {}): void => {
	const argv = process.argv.slice(2);
	let following = false;

	NodeRuntime.runMain(
		// The state directory comes from the environment by log.sh's own rule.
		Effect.flatMap(stateHome.pipe(Effect.provide(ShellStateXdg)), (home) =>
			run(argv, {
				version: CLI_VERSION,
				cwd: process.cwd(),
				nodeVersion: process.versions.node,
				stateHome: home,
				platform: NodeServices.layer,
				distribution: options.distribution,
			}),
		).pipe(
			Effect.provideService(CurrentFollow, {
				...DEFAULT_FOLLOW,
				onStart: () => {
					following = true;
				},
			}),
		),
		{ teardown: exitAfterFlush(() => following) },
	);
};
