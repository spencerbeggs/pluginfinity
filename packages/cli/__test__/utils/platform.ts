import * as NodeServices from "@effect/platform-node/NodeServices";
import type { Cause } from "effect";
import { Effect, Layer, Queue, Stdio, Terminal } from "effect";

/**
 * A platform for running `program` under `CliRuntime.main` in process: the
 * real Node services, with stdio pinned to a pipe (no terminal, so no colour
 * and no prompts) and a terminal that is never read. Its size is a fixed
 * 80 by 24 that never resizes.
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
			size: Effect.acquireRelease(
				Queue.sliding<Terminal.Size, Cause.Done>(1).pipe(
					Effect.tap((queue) => Queue.offer(queue, { columns: 80, rows: 24 })),
				),
				Queue.shutdown,
			),
			readInput: Effect.die("unused"),
			readLine: Effect.die("unused"),
			display: () => Effect.void,
		}),
	),
);
