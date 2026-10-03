import { Schema } from "effect";

/** Decode the way the config loader does: unknown keys fail, every issue is reported. */
export const decodeStrict =
	<S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
	(input: unknown) =>
		Schema.decodeUnknownEffect(schema)(input, { onExcessProperty: "error", errors: "all" });
