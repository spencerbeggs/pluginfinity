import { Schema } from "effect";
import { PluginRelativePath } from "./hooks.js";

// The names the env library, the hosts, the shell and the loader own: a declared one
// would shadow them in every hook and, on Claude Code, in the model's shell.
const RESERVED_NAME_LIST = [
	"PATH",
	"IFS",
	"HOME",
	"PWD",
	"XDG_STATE_HOME",
	"TMPDIR",
	"SHELL",
	"BASH_ENV",
	"ENV",
	"CDPATH",
	"SHELLOPTS",
	"BASHOPTS",
	"PS4",
] as const;
const RESERVED_NAMES: ReadonlySet<string> = new Set(RESERVED_NAME_LIST);
const RESERVED_PREFIXES = ["PLUGINFINITY_", "_PF_", "CLAUDE_", "COPILOT_", "LD_", "DYLD_"] as const;
const RESERVED_MESSAGE = `is reserved: ${RESERVED_NAME_LIST.join(", ")} and names starting ${RESERVED_PREFIXES.join(", ")} belong to the env library, a host, the shell or the dynamic loader`;
const NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const NAME_MESSAGE = "must be upper case letters, digits and _, not starting with a digit";
const isReserved = (name: string): boolean =>
	RESERVED_NAMES.has(name) || RESERVED_PREFIXES.some((prefix) => name.startsWith(prefix));

/**
 * A session variable's name: upper case letters, digits and `_`, not starting
 * with a digit.
 *
 * @remarks
 * The env library, the hosts, the shell and the dynamic loader own some names:
 * `PATH`, `IFS`, `HOME`, `PWD`, `XDG_STATE_HOME`, `TMPDIR`, `SHELL`,
 * `BASH_ENV`, `ENV`, `CDPATH`, `SHELLOPTS`, `BASHOPTS` and `PS4`, and every name
 * starting `PLUGINFINITY_`, `_PF_`, `CLAUDE_`, `COPILOT_`, `LD_` or `DYLD_`. A
 * declared one would shadow them in every hook, so they are rejected.
 *
 * @public
 */
export const EnvVarName = Schema.String.check(
	Schema.isPattern(NAME_PATTERN, { message: NAME_MESSAGE }),
	Schema.makeFilter((name: string) => (isReserved(name) ? RESERVED_MESSAGE : undefined)),
);

/**
 * One declared session variable. Values are strings; `default` defaults to `""`
 * and holds no newline or other control character but tab.
 *
 * @public
 */
export const EnvVar = Schema.Struct({
	/** The value when nothing else sets it, on one line with no control character but tab. Defaults to `""`. */
	default: Schema.optionalKey(
		Schema.String.check(
			// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are rejected on purpose
			Schema.isPattern(/^[^\u0000-\u0008\u000a-\u001f\u007f]*$/, {
				message:
					"must be one line with no control character but tab: the session values file holds one NAME=value per line",
			}),
		),
	),
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
	/** The declared variables, keyed by name: each an {@link EnvVarName}. */
	vars: Schema.Record(Schema.String, EnvVar),
	/** A plugin-relative script that prints `NAME=value` lines at SessionStart. */
	setup: Schema.optionalKey(PluginRelativePath),
}).check(
	// The names are checked here rather than as the Record's key schema: under
	// onExcessProperty "error" a key that fails its schema is reported only as an
	// excess property, and the rule it broke never reaches the message.
	Schema.makeFilter((env: { readonly vars: Readonly<Record<string, unknown>> }) =>
		Object.keys(env.vars).flatMap((name) => {
			const issue = !NAME_PATTERN.test(name) ? NAME_MESSAGE : isReserved(name) ? RESERVED_MESSAGE : undefined;
			return issue === undefined ? [] : [{ path: ["vars", name], issue }];
		}),
	),
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
