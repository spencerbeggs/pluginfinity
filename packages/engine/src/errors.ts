import type { Remediation } from "@effected/engine";
import { KNOWN_TARGET_IDS } from "@pluginfinity/targets";
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

/**
 * The ways to clear a token or link problem besides correcting it: keep the
 * passage from the failing target, keep the braces literal, or keep a link
 * literal in inline code. A host block must name a target other than the failing one.
 */
const tokenAlternatives = (failing: ReadonlyArray<string | undefined>): string => {
	const named = new Set(failing.filter((target): target is string => target !== undefined));
	const others = KNOWN_TARGET_IDS.filter((target) => !named.has(target));
	const block =
		others.length > 0
			? `use a host block (<!-- pluginfinity:only ${others.join(" ")} -->) around a passage only another target can build`
			: "use a host block (<!-- pluginfinity:only <other target> -->) around a passage only another target can build";
	return `${block}, \`\\{{\` to keep a token literal, or inline code to keep a pluginfinity:// link literal`;
};

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
export const HookScriptProblem = Schema.Literals(["missing", "not-executable", "equals-in-path"]);

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
			: this.problem === "equals-in-path"
				? `hook script ${this.script} has "=" in its path, and ${this.path} sets scripts.invoke to "exec", where Claude Code runs it after env and env reads it as a variable assignment`
				: `hook script ${this.script} is not executable, and ${this.path} sets scripts.invoke to "exec"`;
	}

	get remediation(): Remediation {
		return this.problem === "missing"
			? { hint: `Create ${this.script} under the plugin root, or fix the path in ${this.path}.` }
			: this.problem === "equals-in-path"
				? { hint: `Rename ${this.script} without "=", or drop scripts.invoke so hooks run through bash.` }
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
 * A copied source file would land on a path pluginfinity owns: a file it
 * generates, a directory it reserves for an injected library, or a server
 * config file the host loads beside servers written inline.
 *
 * @public
 */
export class PathConflict extends Schema.TaggedError<PathConflict>()("PathConflict", {
	/** The config. */
	path: Schema.String,
	target: Schema.String,
	/** The build path both claim, relative to `builds/<target>/`. */
	file: Schema.String,
	/** Why the path is taken: a generated file, a reserved library directory, or a reserved server file. */
	conflict: Schema.Literals(["generated", "reserved-dir", "reserved-server-file"]),
}) {
	override get message(): string {
		switch (this.conflict) {
			case "reserved-dir":
				return `${this.file} is under a directory pluginfinity reserves for its injected library`;
			case "reserved-server-file":
				return `${this.target} loads ${this.file} as a server config file, but the plugin also ships a source file at that path`;
			default:
				return `${this.target} generates ${this.file}, but the plugin also ships a source file at that path`;
		}
	}

	get remediation(): Remediation {
		switch (this.conflict) {
			case "reserved-dir":
				return { hint: `Move ${this.file} out of the reserved directory.` };
			case "reserved-server-file":
				return {
					hint: `Declare those servers under mcpServers or lspServers in the pluginfinity config instead of shipping ${this.file}.`,
				};
			default:
				return { hint: `Delete or move the source ${this.file}; pluginfinity writes that file itself.` };
		}
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
		const lead = `Correct the listed problems in ${this.path}`;
		if (tokens > 0 && tokens === this.issues.length) {
			return { hint: `${lead}; to keep a passage from this target, ${tokenAlternatives([this.target])}.` };
		}
		const field =
			this.target === undefined
				? lead
				: `${lead}, or set the field for ${this.target} in its \`targets.${this.target}\` block`;
		return { hint: tokens > 0 ? `${field}; for a token or link, ${tokenAlternatives([this.target])}.` : `${field}.` };
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
		const failing = this.components.filter((component) => component.issues.some((issue) => issue.kind === "token"));
		const base = "Correct each listed file; a field one host cannot take can be set in that host's `targets` block";
		return {
			hint:
				failing.length > 0
					? `${base}; to keep a passage from a target, ${tokenAlternatives(failing.map((component) => component.target))}.`
					: `${base}.`,
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
