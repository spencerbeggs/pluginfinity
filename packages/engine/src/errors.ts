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
	/** `"token"` for a body token or `pluginfinity://` link that cannot be built. */
	kind: Schema.optionalKey(Schema.Literal("token")),
}) {}

/** How to clear a token or link problem: keep the passage from the target, or keep the braces literal. */
const TOKEN_HINT =
	"use a host block (<!-- pluginfinity:only claude -->) around the passage, or write `\\{{` to keep it literal";

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
 * target id. Base fields and target ids share one key space, so the key may
 * be a misspelt field as easily as an unknown target; the message lists both.
 *
 * @public
 */
export class UnknownTarget extends Schema.TaggedError<UnknownTarget>()("UnknownTarget", {
	path: Schema.String,
	/** The unknown keys, in the order the config spells them. */
	targets: Schema.Array(Schema.String),
	/** Every known target id. */
	known: Schema.Array(Schema.String),
	/** Every base config field. */
	fields: Schema.Array(Schema.String),
}) {
	override get message(): string {
		const keys = this.targets.map((target) => `"${target}"`).join(", ");
		return `${this.path} has unknown key ${keys}: not a config field (${this.fields.join(", ")}) or a known target (${this.known.join(", ")})`;
	}

	get remediation(): Remediation {
		return { hint: `Fix the spelling of the key in ${this.path}, or remove it.` };
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

/**
 * The `package.json` beside a config is missing, unreadable, or has no
 * `version` string. Every manifest copies its version from there.
 *
 * @public
 */
export class PackageVersionMissing extends Schema.TaggedError<PackageVersionMissing>()("PackageVersionMissing", {
	/** The `package.json` path that was read. */
	path: Schema.String,
}) {
	override get message(): string {
		return `${this.path} is missing or has no "version" string`;
	}

	get remediation(): Remediation {
		return { hint: `Add a package.json with a "version" field beside the config; every manifest copies it.` };
	}
}

/**
 * How one target's `builds/<id>/` differs from a fresh build.
 *
 * @public
 */
export class TargetDrift extends Schema.Class<TargetDrift>("TargetDrift")({
	target: Schema.String,
	added: Schema.Array(Schema.String),
	changed: Schema.Array(Schema.String),
	removed: Schema.Array(Schema.String),
}) {}

/**
 * `build --check` or `validate` found `builds/` out of date with the source.
 *
 * @public
 */
export class BuildStale extends Schema.TaggedError<BuildStale>()("BuildStale", {
	/** The config whose builds drifted. */
	path: Schema.String,
	targets: Schema.Array(TargetDrift),
}) {
	override get message(): string {
		const describe = (drift: TargetDrift): string =>
			[
				["added", drift.added],
				["changed", drift.changed],
				["removed", drift.removed],
			]
				.filter(([, files]) => files.length > 0)
				.map(([verb, files]) => `${verb} ${(files as ReadonlyArray<string>).join(", ")}`)
				.join("; ");
		return `builds are out of date for ${this.path}: ${this.targets
			.map((drift) => `${drift.target} would have ${describe(drift)}`)
			.join("; ")}`;
	}

	get remediation(): Remediation {
		return { hint: "Run `pluginfinity build` and commit the result." };
	}
}

/**
 * A host's own CLI rejected a build, or could not be run to check it.
 *
 * @public
 */
export class HostRejected extends Schema.TaggedError<HostRejected>()("HostRejected", {
	/** The build directory the host checked. */
	path: Schema.String,
	target: Schema.String,
	/** The command line, as run. */
	command: Schema.String,
	/** What the host printed, stdout then stderr, trimmed. */
	output: Schema.String,
}) {
	override get message(): string {
		return `${this.target} rejected ${this.path}: ${this.output === "" ? `\`${this.command}\` failed` : this.output}`;
	}

	get remediation(): Remediation {
		return { hint: `Run \`${this.command}\` to see the host's report, or pass --no-host to skip host checks.` };
	}
}

/**
 * A target lacks a hook event the config uses, and an entry for it does not
 * set `fallback: "omit"`.
 *
 * @public
 */
export class HookEventUnsupported extends Schema.TaggedError<HookEventUnsupported>()("HookEventUnsupported", {
	/** The config. */
	path: Schema.String,
	target: Schema.String,
	events: Schema.Array(Schema.String),
}) {
	override get message(): string {
		return `${this.target} has no hook event ${this.events.map((event) => `"${event}"`).join(", ")}, used in ${this.path}`;
	}

	get remediation(): Remediation {
		return {
			hint: `Set \`fallback: "omit"\` on those entries to skip them on ${this.target}, or give ${this.target} its own hooks for the event.`,
		};
	}
}

/**
 * What is wrong with a hook script: absent from the plugin, or lacking the
 * executable bit under `scripts.invoke: "exec"`.
 *
 * @public
 */
export const HookScriptProblem = Schema.Literals(["missing", "not-executable"]);

/**
 * A hook `script` cannot be shipped as configured.
 *
 * @public
 */
export class HookScriptInvalid extends Schema.TaggedError<HookScriptInvalid>()("HookScriptInvalid", {
	/** The config. */
	path: Schema.String,
	/** The script, relative to the plugin root. */
	script: Schema.String,
	problem: HookScriptProblem,
}) {
	override get message(): string {
		return this.problem === "missing"
			? `hook script ${this.script} named in ${this.path} does not exist`
			: `hook script ${this.script} is not executable, and ${this.path} sets scripts.invoke to "exec"`;
	}

	get remediation(): Remediation {
		return this.problem === "missing"
			? { hint: `Create ${this.script} under the plugin root, or fix the path in ${this.path}.` }
			: { hint: `Run \`chmod +x ${this.script}\`, or drop scripts.invoke so hooks run through bash.` };
	}
}

/**
 * What is wrong with a file a server or the `files` key ships.
 *
 * @public
 */
export const ShippedFileProblem = Schema.Literals([
	"missing",
	"not-executable",
	"directory",
	"outside-root",
	"not-normal",
]);

/**
 * A file the build must ship for a server, or because `files` lists it, cannot be shipped.
 *
 * @public
 */
export class ShippedFileInvalid extends Schema.TaggedError<ShippedFileInvalid>()("ShippedFileInvalid", {
	/** The config. */
	path: Schema.String,
	/** The file, relative to the plugin root. */
	file: Schema.String,
	/** What names it: `mcpServers.<name>`, `lspServers.<name>` (prefixed `<target>.` when a target override sets it) or `files`. */
	referencedBy: Schema.String,
	problem: ShippedFileProblem,
}) {
	override get message(): string {
		const why = {
			missing: "does not exist",
			"not-executable": "is its command but is not executable",
			directory: "is its command but is a directory",
			"outside-root": "resolves outside the plugin",
			"not-normal": "has an empty, . or .. segment",
		}[this.problem];
		return `${this.file}, named by ${this.referencedBy} in ${this.path}, ${why}`;
	}

	get remediation(): Remediation {
		const hint = {
			missing: `Create ${this.file} under the plugin root, or fix the path in ${this.referencedBy}.`,
			"not-executable": `Run \`chmod +x ${this.file}\`, or run it through sh: command "sh" with the path in args.`,
			directory: `Name the launcher file inside ${this.file} as the command; a directory ships whole only when another server field names it.`,
			"outside-root": "Keep shipped files inside the plugin directory; a path or symlink that leaves it cannot ship.",
			"not-normal": `Write the path in ${this.referencedBy} without . or .. segments, as it lies under the plugin root.`,
		}[this.problem];
		return { hint };
	}
}

/**
 * A copied source file and a generated file would land on the same build path.
 *
 * @public
 */
export class PathConflict extends Schema.TaggedError<PathConflict>()("PathConflict", {
	/** The config. */
	path: Schema.String,
	target: Schema.String,
	/** The build path both claim, relative to `builds/<target>/`. */
	file: Schema.String,
}) {
	override get message(): string {
		return `${this.target} generates ${this.file}, but the plugin also ships a source file at that path`;
	}

	get remediation(): Remediation {
		return { hint: `Delete or move the source ${this.file}; pluginfinity writes that file itself.` };
	}
}

/**
 * A skill or agent file does not decode, or cannot be built for a target:
 * bad frontmatter, a name that breaks the rules, a malformed host block, or a
 * field the target cannot place.
 *
 * @public
 */
export class ComponentInvalid extends Schema.TaggedError<ComponentInvalid>()("ComponentInvalid", {
	/** The component file, or its directory when the file is missing. */
	path: Schema.String,
	/** The target the problem is specific to, when it is. */
	target: Schema.optionalKey(Schema.String),
	issues: Schema.Array(ConfigIssue),
}) {
	override get message(): string {
		const where = this.target === undefined ? this.path : `${this.path} (for ${this.target})`;
		return `${where}: ${this.issues
			.map((issue) => (issue.key === "" ? issue.message : `${issue.key}: ${issue.message}`))
			.join("; ")}`;
	}

	get remediation(): Remediation {
		const tokens = this.issues.filter((issue) => issue.kind === "token").length;
		if (tokens > 0 && tokens === this.issues.length) {
			return { hint: `For a token or link ${this.target ?? "a target"} cannot build, ${TOKEN_HINT}.` };
		}
		const field =
			this.target === undefined
				? `Correct the listed problems in ${this.path}`
				: `Correct the listed problems in ${this.path}, or set the field for ${this.target} in its \`targets.${this.target}\` block`;
		return { hint: tokens > 0 ? `${field}; for a token or link, ${TOKEN_HINT}.` : `${field}.` };
	}
}

/**
 * Every skill and agent problem one build found, so a single run reports them
 * all.
 *
 * @public
 */
export class ComponentsInvalid extends Schema.TaggedError<ComponentsInvalid>()("ComponentsInvalid", {
	/** The config. */
	path: Schema.String,
	components: Schema.Array(ComponentInvalid),
}) {
	override get message(): string {
		const count = this.components.length;
		return [
			`${count} ${count === 1 ? "component is" : "components are"} invalid in the plugin of ${this.path}:`,
			...this.components.map((component) => `  - ${component.message}`),
		].join("\n");
	}

	get remediation(): Remediation {
		return {
			hint: this.components.some((component) => component.issues.some((issue) => issue.kind === "token"))
				? `Correct each listed file; a field one host cannot take can be set in that host's \`targets\` block, and for a token or link one host cannot build, ${TOKEN_HINT}.`
				: "Correct each listed file; a field one host cannot take can be set in that host's `targets` block.",
		};
	}
}

/**
 * Every finding a build or validation can produce after its config loaded.
 *
 * @public
 */
export type BuildError =
	| PackageVersionMissing
	| BuildStale
	| HostRejected
	| HookEventUnsupported
	| HookScriptInvalid
	| ShippedFileInvalid
	| PathConflict
	| ComponentsInvalid;

const BUILD_ERROR_TAGS: ReadonlyArray<string> = [
	"PackageVersionMissing",
	"BuildStale",
	"HostRejected",
	"HookEventUnsupported",
	"HookScriptInvalid",
	"ShippedFileInvalid",
	"PathConflict",
	"ComponentsInvalid",
];

/**
 * Whether `error` is one of the {@link BuildError} members.
 *
 * @public
 */
export const isBuildError = (error: unknown): error is BuildError =>
	typeof error === "object" &&
	error !== null &&
	"_tag" in error &&
	typeof error._tag === "string" &&
	BUILD_ERROR_TAGS.includes(error._tag);
