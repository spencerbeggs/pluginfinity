// Config and build errors are findings, not crashes: a person reads the message and the
// remediation on stderr; an agent or CI reads one JSON object on stdout. Both
// exit 1 through `CliExit`, so the run itself still succeeds.

import { CliExit } from "@effected/cli";
import { CurrentDistribution } from "@effected/engine";
import { Audience } from "@effected/env";
import type { BuildError, ConfigError } from "@pluginfinity/engine";
import { ENGINE_VERSION, isBuildError, isConfigError } from "@pluginfinity/engine";
import { Console, Effect, Option } from "effect";

/** Whether `error` is a finding {@link reportConfigError} reports. */
export const isFinding = (error: unknown): error is ConfigError | BuildError =>
	isConfigError(error) || isBuildError(error);

/** Report a config or build error for the current audience and record exit code 1. */
export const reportConfigError = (error: ConfigError | BuildError): Effect.Effect<void, never, Audience | CliExit> =>
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

/**
 * Report every config or build error `self` fails with, passing any other
 * failure through.
 */
export const reportFindings = <E, R>(
	self: Effect.Effect<void, E, R>,
): Effect.Effect<void, Exclude<E, ConfigError | BuildError>, R | Audience | CliExit> =>
	self.pipe(
		Effect.catch((error) =>
			// A type guard on an unknown parameter cannot narrow a generic E, so
			// the pass-through branch states what it already is.
			isFinding(error) ? reportConfigError(error) : Effect.fail(error as Exclude<E, ConfigError | BuildError>),
		),
	);
