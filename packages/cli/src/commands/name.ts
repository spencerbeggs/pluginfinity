import { PluginName } from "@pluginfinity/core";
import { Effect, Schema } from "effect";
import { CliError } from "effect/cli";

/** Check a plugin name from the command line: kebab-case, or a usage error naming the flag. */
export const checkPluginName = (label: string, name: string): Effect.Effect<string, CliError.UserError> =>
	Schema.decodeUnknownEffect(PluginName)(name).pipe(
		Effect.mapError(
			() =>
				new CliError.UserError({
					cause: `${label} "${name}" must be kebab-case: lowercase letters and digits separated by single hyphens`,
				}),
		),
	);
