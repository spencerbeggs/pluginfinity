import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Stdio, Terminal } from "effect";

/**
 * A platform for running `program` under `CliRuntime.main` in process: the
 * real Node services, with stdio pinned to a pipe (no terminal, so no colour
 * and no prompts) and a terminal that is never read.
 */
export const testPlatform = Layer.mergeAll(
	NodeServices.layer,
	Stdio.layerTest({
		stdinIsTerminal: Effect.succeed(false),
		stdoutIsTerminal: Effect.succeed(false),
	}),
	Layer.succeed(
		Terminal.Terminal,
		Terminal.make({
			columns: Effect.succeed(80),
			rows: Effect.succeed(24),
			readInput: Effect.die("unused"),
			readLine: Effect.die("unused"),
			display: () => Effect.void,
		}),
	),
);
