import { Schema } from "effect";
import { PluginRelativePath } from "./hooks.js";

// The names the env library and the shell itself own: a declared one would shadow them.
const RESERVED_NAMES = new Set(["PATH", "IFS", "HOME", "PWD"]);
const RESERVED_PREFIXES = ["PLUGINFINITY_", "_PF_"];

/**
 * A session variable's name: upper case letters, digits and `_`, not starting
 * with a digit.
 *
 * @remarks
 * The env library and the shell own a few names: `PLUGINFINITY_` and `_PF_`
 * prefixes, and `PATH`, `IFS`, `HOME` and `PWD`. A declared one would shadow
 * them in every hook, so they are rejected.
 *
 * @public
 */
export const EnvVarName = Schema.String.check(
	Schema.isPattern(/^[A-Z_][A-Z0-9_]*$/, {
		message: "must be upper case letters, digits and _, not starting with a digit",
	}),
	Schema.makeFilter((name: string) =>
		!RESERVED_NAMES.has(name) && !RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix))
			? undefined
			: "is reserved: PATH, IFS, HOME, PWD and names starting PLUGINFINITY_ or _PF_ belong to the env library",
	),
);

/**
 * One declared session variable. Values are strings; `default` defaults to `""`.
 *
 * @public
 */
export const EnvVar = Schema.Struct({
	/** The value when nothing else sets it. Defaults to `""`. */
	default: Schema.optionalKey(Schema.String),
	/** What the variable holds, for readers of the config. */
	description: Schema.optionalKey(Schema.String),
});

/**
 * The session variables a plugin keeps, resolved once at SessionStart and
 * read by its hooks, skill scripts and monitors.
 *
 * @remarks
 * With `prefix` set, every declared name must start with `${prefix}_`. `setup`
 * is a plugin-relative script whose `NAME=value` stdout lines rank above the
 * defaults and below the project's `.env`. Record keys cannot repeat, so a
 * name is declared once.
 *
 * @public
 */
export const EnvConfig = Schema.Struct({
	/** When set, every declared name starts with `${prefix}_`. */
	prefix: Schema.optionalKey(
		Schema.String.check(
			Schema.isPattern(/^[A-Z_][A-Z0-9_]*$/, {
				message: "must be upper case letters, digits and _, not starting with a digit",
			}),
		),
	),
	/** The declared variables, keyed by name. */
	vars: Schema.Record(EnvVarName, EnvVar),
	/** A plugin-relative script that prints `NAME=value` lines at SessionStart. */
	setup: Schema.optionalKey(PluginRelativePath),
}).check(
	Schema.makeFilter((env: { readonly prefix?: string; readonly vars: Readonly<Record<string, unknown>> }) => {
		const prefix = env.prefix;
		if (prefix === undefined) return undefined;
		return Object.keys(env.vars)
			.filter((name) => !name.startsWith(`${prefix}_`))
			.map((name) => ({ path: ["vars", name], issue: `must start with the prefix "${prefix}_"` }));
	}),
);

/**
 * The decoded `EnvConfig`.
 *
 * @public
 */
export type EnvConfig = typeof EnvConfig.Type;
