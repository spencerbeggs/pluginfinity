import { Schema } from "effect";

/**
 * A name every host accepts: kebab-case, lowercase letters and digits
 * separated by single hyphens.
 *
 * @public
 */
export const KebabName = Schema.String.check(
	Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message: "must be kebab-case: lowercase letters and digits separated by single hyphens",
	}),
);
