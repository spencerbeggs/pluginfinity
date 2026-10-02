// Config errors are findings, not crashes: a person reads the message and the
// remediation on stderr; an agent or CI reads one JSON object on stdout. Both
// exit 1 through `CliExit`, so the run itself still succeeds.

import { CliExit } from "@effected/cli";
import { CurrentDistribution } from "@effected/engine";
import { Audience } from "@effected/env";
import type { ConfigError } from "@pluginfinity/engine";
import { ENGINE_VERSION } from "@pluginfinity/engine";
import { Console, Effect, Option } from "effect";

/** Report a config error for the current audience and record exit code 1. */
export const reportConfigError = (error: ConfigError): Effect.Effect<void, never, Audience | CliExit> =>
	Effect.gen(function* () {
		const audience = yield* Audience;
		if (audience.kind === "human") {
			yield* Console.error(`✗ ${error.message}`);
			yield* Console.error(`  ${error.remediation.hint}`);
		} else {
			const distribution = yield* CurrentDistribution;
			yield* Console.log(
				JSON.stringify({
					engine_version: ENGINE_VERSION,
					distribution: Option.getOrNull(distribution),
					ok: false,
					error: { tag: error._tag, path: error.path, message: error.message, remediation: error.remediation },
				}),
			);
		}
		yield* CliExit.set(1);
	});
