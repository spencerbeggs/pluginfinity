import type { Remediation } from "@effected/engine";
import { Schema } from "effect";

/**
 * One problem found while decoding a config: where in the config, and what.
 *
 * @public
 */
export class ConfigIssue extends Schema.Class<ConfigIssue>("ConfigIssue")({
	/** The dotted key path inside the config, `""` for the config as a whole. */
	key: Schema.String,
	message: Schema.String,
}) {}

/**
 * The upward walk reached a `.git` directory or the filesystem root without
 * finding a config, or an explicit `--config` file does not exist.
 *
 * @public
 */
export class ConfigNotFound extends Schema.TaggedError<ConfigNotFound>()("ConfigNotFound", {
	/** Where discovery started, or the explicit config file that is missing. */
	path: Schema.String,
	/** Set when `path` is a file the user named with `--config`, not a discovery start. */
	explicit: Schema.optionalKey(Schema.Boolean),
}) {
	override get message(): string {
		return this.explicit === true
			? `config file ${this.path} does not exist`
			: `no pluginfinity.config.{ts,mts,js,mjs} found from ${this.path}`;
	}

	get remediation(): Remediation {
		return this.explicit === true
			? { hint: "Check the path given to --config; a relative path resolves against the launch directory." }
			: {
					hint: "Run pluginfinity from inside a plugin, pass its directory as [path], or name the file with --config.",
				};
	}
}

/**
 * One directory holds more than one config file.
 *
 * @public
 */
export class ConfigAmbiguous extends Schema.TaggedError<ConfigAmbiguous>()("ConfigAmbiguous", {
	/** The directory holding the configs. */
	path: Schema.String,
	files: Schema.Array(Schema.String),
}) {
	override get message(): string {
		return `${this.path} holds more than one config: ${this.files.join(", ")}`;
	}

	get remediation(): Remediation {
		return { hint: `Keep one pluginfinity config in ${this.path} and delete the others.` };
	}
}

/**
 * Importing the config threw: a syntax error or an unresolved import.
 *
 * @public
 */
export class ConfigLoadFailed extends Schema.TaggedError<ConfigLoadFailed>()("ConfigLoadFailed", {
	path: Schema.String,
	/** The first line of what the import threw. */
	detail: Schema.String,
}) {
	override get message(): string {
		return `could not load ${this.path}: ${this.detail}`;
	}

	get remediation(): Remediation {
		return { hint: `Fix the error in ${this.path} so it imports cleanly.` };
	}
}

/**
 * The config's default export does not decode, or it enables no target.
 *
 * @public
 */
export class ConfigInvalid extends Schema.TaggedError<ConfigInvalid>()("ConfigInvalid", {
	path: Schema.String,
	issues: Schema.Array(ConfigIssue),
}) {
	override get message(): string {
		return `${this.path} is not a valid pluginfinity config: ${this.issues
			.map((issue) => (issue.key === "" ? issue.message : `${issue.key}: ${issue.message}`))
			.join("; ")}`;
	}

	get remediation(): Remediation {
		return { hint: `Correct the listed keys in ${this.path}.` };
	}
}

/**
 * The config sets a top-level key that is neither a base field nor a known
 * target id.
 *
 * @public
 */
export class UnknownTarget extends Schema.TaggedError<UnknownTarget>()("UnknownTarget", {
	path: Schema.String,
	/** The unknown keys, in the order the config spells them. */
	targets: Schema.Array(Schema.String),
	/** Every known target id. */
	known: Schema.Array(Schema.String),
}) {
	override get message(): string {
		return `${this.path} enables unknown target ${this.targets.map((target) => `"${target}"`).join(", ")}; known targets: ${this.known.join(", ")}`;
	}

	get remediation(): Remediation {
		return { hint: `Rename or remove the key in ${this.path}; known targets are ${this.known.join(", ")}.` };
	}
}

/**
 * `--target` named a known target the config does not enable.
 *
 * @public
 */
export class TargetNotEnabled extends Schema.TaggedError<TargetNotEnabled>()("TargetNotEnabled", {
	path: Schema.String,
	target: Schema.String,
	enabled: Schema.Array(Schema.String),
}) {
	override get message(): string {
		return `${this.path} does not enable target "${this.target}" (enabled: ${this.enabled.join(", ")})`;
	}

	get remediation(): Remediation {
		return { hint: `Add \`${this.target}: true\` to ${this.path}, or drop --target ${this.target}.` };
	}
}

/**
 * Every failure finding or loading a config can produce.
 *
 * @public
 */
export type ConfigError =
	| ConfigNotFound
	| ConfigAmbiguous
	| ConfigLoadFailed
	| ConfigInvalid
	| UnknownTarget
	| TargetNotEnabled;

const CONFIG_ERROR_TAGS: ReadonlyArray<string> = [
	"ConfigNotFound",
	"ConfigAmbiguous",
	"ConfigLoadFailed",
	"ConfigInvalid",
	"UnknownTarget",
	"TargetNotEnabled",
];

/**
 * Whether `error` is one of the {@link ConfigError} members.
 *
 * @public
 */
export const isConfigError = (error: unknown): error is ConfigError =>
	typeof error === "object" &&
	error !== null &&
	"_tag" in error &&
	typeof error._tag === "string" &&
	CONFIG_ERROR_TAGS.includes(error._tag);

/**
 * The operation exists in the command surface but is not built yet.
 *
 * @public
 */
export class NotImplemented extends Schema.TaggedError<NotImplemented>()("NotImplemented", {
	/** The command, as typed: `build`, `validate`, `init`, `plugin add`. */
	operation: Schema.String,
}) {
	override get message(): string {
		return `pluginfinity ${this.operation} is not implemented yet`;
	}
}
