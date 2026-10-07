import { Schema } from "effect";

/**
 * The forms a field can be moved into when a host lacks it. The engine owns
 * one renderer per form.
 *
 * @public
 */
export const DEGRADE_FORMS = ["description-suffix", "body-section"] as const;

/** @public */
export const DegradeForm = Schema.Literals(DEGRADE_FORMS);

/** @public */
export type DegradeForm = typeof DegradeForm.Type;

/**
 * Manifest formats. The engine owns one encoder per format.
 *
 * @public
 */
export const MANIFEST_FORMATS = ["claude-plugin-json", "agent-plugins-1.0"] as const;

/** @public */
export const ManifestFormat = Schema.Literals(MANIFEST_FORMATS);

/**
 * Hooks file formats. The engine owns one encoder per format.
 *
 * @public
 */
export const HOOKS_FORMATS = ["claude-hooks-json", "copilot-hooks-v1"] as const;

/** @public */
export const HooksFormat = Schema.Literals(HOOKS_FORMATS);

/**
 * MCP config formats. The engine owns one encoder per format:
 * `claude-mcp-servers` is the bare server map Claude Code reads under a
 * manifest's `mcpServers` key, and `agent-plugins-mcp-1.0` is the Agent
 * Plugins `mcp.json` envelope, `$schema` and an `mcpServers` map.
 *
 * @public
 */
export const MCP_FORMATS = ["claude-mcp-servers", "agent-plugins-mcp-1.0"] as const;

/** @public */
export const McpFormat = Schema.Literals(MCP_FORMATS);

/**
 * LSP config formats. The engine owns one encoder per format:
 * `claude-lsp-servers` is the bare server map Claude Code reads under a
 * manifest's `lspServers` key, and `copilot-lsp-json` is Copilot's
 * `{ "lspServers": … }` file.
 *
 * @public
 */
export const LSP_FORMATS = ["claude-lsp-servers", "copilot-lsp-json"] as const;

/** @public */
export const LspFormat = Schema.Literals(LSP_FORMATS);

const NonEmpty = Schema.String.check(Schema.isMinLength(1));

/** Write a target's servers to a file of their own, at a plugin-relative path. @public */
export class InFile extends Schema.TaggedClass<InFile>()("file", { path: NonEmpty }) {}

/**
 * Write a target's servers inline in its manifest, under a key the manifest's
 * allowlist admits. `reserves` is the plugin-relative file the host also loads
 * servers from by default, such as Claude Code's `.mcp.json`; no file may ship
 * there, since the host would load it beside the inline servers.
 *
 * @public
 */
export class InManifest extends Schema.TaggedClass<InManifest>()("manifest", { key: NonEmpty, reserves: NonEmpty }) {}

/**
 * Where a target writes its MCP or LSP servers: a file of their own, or inline
 * in the manifest.
 *
 * @public
 */
export const ServerPlacement = Schema.Union([InFile, InManifest]);

/** @public */
export type ServerPlacement = typeof ServerPlacement.Type;

/** Write the field unchanged. @public */
export class Keep extends Schema.TaggedClass<Keep>()("keep", {}) {}

/** Write the field under another name. @public */
export class Rename extends Schema.TaggedClass<Rename>()("rename", { to: NonEmpty }) {}

/**
 * The tables a field's value can be translated through: `tools` for tool lists,
 * `models` for a model name, `efforts` for an effort level.
 *
 * @public
 */
export const TranslateTable = Schema.Literals(["tools", "models", "efforts"]);

/** Map the field's value through a named table, optionally writing it under another name. @public */
export class Translate extends Schema.TaggedClass<Translate>()("translate", {
	table: TranslateTable,
	to: Schema.optionalKey(NonEmpty),
}) {}

/** Move the field into a named form the engine renders. @public */
export class Degrade extends Schema.TaggedClass<Degrade>()("degrade", { form: DegradeForm }) {}

/** Leave the field out; the host lacks it. @public */
export class Drop extends Schema.TaggedClass<Drop>()("drop", {}) {}

/**
 * A fact the host documentation leaves open, with a note on what is unknown.
 *
 * @public
 */
export class Unresolved extends Schema.TaggedClass<Unresolved>()("unresolved", { note: NonEmpty }) {}

/** A Claude Code event the target does not have. @public */
export class Absent extends Schema.TaggedClass<Absent>()("absent", {}) {}

/**
 * What a target does with one frontmatter field.
 *
 * @public
 */
export const FieldMapEntry = Schema.Union([Keep, Rename, Translate, Degrade, Drop, Unresolved]);

/** @public */
export type FieldMapEntry = typeof FieldMapEntry.Type;

/**
 * How the plugin root is spelled at one site, or that the docs leave it open.
 *
 * @public
 */
export const RootSpelling = Schema.Union([Schema.String, Unresolved]);

/**
 * A Claude Code event's name on a target, or that the target lacks it.
 *
 * @public
 */
export const EventMapping = Schema.Union([Schema.String, Absent]);

/**
 * A Claude Code tool name's spelling on a target, `drop` to leave it out, or
 * that the docs leave it open.
 *
 * @public
 */
export const ToolMapping = Schema.Union([Schema.String, Drop, Unresolved]);

/**
 * A Claude Code value's spelling on a target, in the `models` or `efforts`
 * table: the target's value, `drop` to leave the field out, or `unresolved`
 * when the target has no counterpart and the author must choose.
 *
 * @public
 */
export const ValueMapping = Schema.Union([Schema.String, Drop, Unresolved]);

const FieldMap = Schema.Record(Schema.String, FieldMapEntry);

/**
 * One host, described by what it can do.
 *
 * @remarks
 * Build a description with `Target.make`, which validates it at construction,
 * so a malformed host description fails when `@pluginfinity/targets` loads.
 * Field maps are typed as string records here; `@pluginfinity/targets` checks
 * their totality over `SKILL_FIELDS`, `AGENT_FIELDS` and `LSP_FIELDS` at compile time and in
 * tests. A tool name absent from `tools.names` follows `tools.unlisted`; a value
 * absent from `models` or `efforts` passes through unchanged.
 *
 * @public
 */
export class Target extends Schema.Class<Target>("Target")({
	manifest: Schema.Struct({
		path: Schema.String,
		format: ManifestFormat,
		schema: Schema.optionalKey(Schema.String),
		keys: Schema.Array(Schema.String),
	}),
	pluginRoot: Schema.Struct({ hooks: RootSpelling, mcp: RootSpelling, lsp: RootSpelling, body: RootSpelling }),
	skills: Schema.Struct({
		dir: Schema.String,
		fields: FieldMap,
		hostFields: Schema.Array(Schema.String),
		/**
		 * How a user invokes a plugin skill: a template with `{plugin}` and `{skill}`,
		 * or `unresolved` when the host has no such command.
		 */
		invoke: Schema.Union([Schema.String, Unresolved]),
		/**
		 * How a skill body names a skill's directory: `own` for the skill the body
		 * belongs to, `other` for a sibling, a template with `{skill}`, and `agent`
		 * for a sibling named from an agent body, which has no skill base
		 * directory. Where the host expands no path in bodies these are
		 * placeholders the model fills in, not paths.
		 */
		dirSpelling: Schema.Struct({ own: Schema.String, other: Schema.String, agent: RootSpelling }),
	}),
	agents: Schema.Struct({
		dir: Schema.String,
		suffix: Schema.String,
		fields: FieldMap,
		hostFields: Schema.Array(Schema.String),
		/** A plugin agent's run-time id: a template with `{plugin}` and `{agent}`. */
		id: Schema.String,
	}),
	hooks: Schema.Struct({
		path: Schema.String,
		format: HooksFormat,
		events: Schema.Record(Schema.String, EventMapping),
		ownEvents: Schema.Array(Schema.String),
		/**
		 * The Claude events whose matcher the host ignores. The build drops the
		 * host `matcher` key there and the hook library applies the matcher at
		 * run time instead.
		 */
		matcherIgnored: Schema.Array(Schema.String),
		/**
		 * The Claude events where the host honours each kind of hook output: the
		 * `context` a hook adds to the model's view and the `system_message` it
		 * shows the user. Mirrors `hook_supports` in the hook library, which a test
		 * pins; the build notes a script that emits output the host would ignore.
		 */
		output: Schema.Struct({
			context: Schema.Array(Schema.String),
			system_message: Schema.Array(Schema.String),
		}),
		/**
		 * The Claude events from which the host passes values a hook exports to
		 * the model's shell (Claude Code's `CLAUDE_ENV_FILE`); empty when it has
		 * no such channel, and a skill script must source `env.sh` instead.
		 */
		envShell: Schema.Array(Schema.String),
	}),
	mcp: Schema.Struct({
		placement: ServerPlacement,
		format: McpFormat,
		schema: Schema.optionalKey(Schema.String),
	}),
	lsp: Schema.Struct({ placement: ServerPlacement, format: LspFormat, fields: FieldMap }),
	/**
	 * Where the host reads background monitors and how it spells the plugin root
	 * in their commands, or `unresolved` when the host has no monitors.
	 */
	monitors: Schema.Union([Schema.Struct({ path: Schema.String, root: Schema.String }), Unresolved]),
	references: Schema.Struct({ style: Schema.Literals(["path", "prose"]) }),
	tools: Schema.Struct({
		names: Schema.Record(Schema.String, ToolMapping),
		mcp: Schema.String,
		/**
		 * What happens to a tool name the table does not list and that is not a
		 * Claude MCP name the target can spell: `keep` writes it unchanged, `drop`
		 * leaves it out, for a host that has no such tool.
		 */
		unlisted: Schema.Literals(["keep", "drop"]),
		/**
		 * The tool names the host shows a model at run time, which a skill or agent
		 * body can name. `names` maps a Claude Code tool name to its run-time
		 * spelling (or `unresolved`); `mcp` is the template for a plugin MCP tool
		 * (`{plugin}`, `{server}`, `{tool}`); `unlisted` says whether a name absent
		 * from `names` is `keep`-kept as written or `unresolved`.
		 */
		runtime: Schema.Struct({
			names: Schema.Record(Schema.String, Schema.Union([Schema.String, Unresolved])),
			mcp: Schema.String,
			unlisted: Schema.Literals(["keep", "unresolved"]),
		}),
	}),
	models: Schema.Record(Schema.String, ValueMapping),
	efforts: Schema.Record(Schema.String, ValueMapping),
}) {}

/** @public */
export const inFile = (path: string): InFile => InFile.make({ path });

/** @public */
export const inManifest = (key: string, reserves: string): InManifest => InManifest.make({ key, reserves });

/** @public */
export const keep: Keep = Keep.make({});

/** @public */
export const drop: Drop = Drop.make({});

/** @public */
export const absent: Absent = Absent.make({});

/** @public */
export const rename = (to: string): Rename => Rename.make({ to });

/** @public */
export const translate = (table: typeof TranslateTable.Type, to?: string): Translate =>
	Translate.make(to === undefined ? { table } : { table, to });

/** @public */
export const degrade = (form: DegradeForm): Degrade => Degrade.make({ form });

/** @public */
export const unresolved = (note: string): Unresolved => Unresolved.make({ note });
