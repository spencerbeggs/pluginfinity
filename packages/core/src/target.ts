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
 * MCP config formats. The engine owns one encoder per format.
 *
 * @public
 */
export const MCP_FORMATS = ["claude-mcp-json", "agent-plugins-mcp-1.0"] as const;

/** @public */
export const McpFormat = Schema.Literals(MCP_FORMATS);

/**
 * A fact the host documentation leaves open, with a note on what is unknown.
 *
 * @public
 */
export const Unresolved = Schema.TaggedStruct("unresolved", { note: Schema.String.check(Schema.isMinLength(1)) });

/**
 * What a target does with one frontmatter field.
 *
 * @public
 */
export const FieldMapEntry = Schema.Union([
	Schema.TaggedStruct("keep", {}),
	Schema.TaggedStruct("rename", { to: Schema.String.check(Schema.isMinLength(1)) }),
	Schema.TaggedStruct("translate", { table: Schema.Literal("tools") }),
	Schema.TaggedStruct("degrade", { form: DegradeForm }),
	Schema.TaggedStruct("drop", {}),
	Unresolved,
]);

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
export const EventMapping = Schema.Union([Schema.String, Schema.TaggedStruct("absent", {})]);

/**
 * A Claude Code tool name's spelling on a target, or that the docs leave it open.
 *
 * @public
 */
export const ToolMapping = Schema.Union([Schema.String, Unresolved]);

const FieldMap = Schema.Record(Schema.String, FieldMapEntry);

/**
 * One host, described by what it can do.
 *
 * @remarks
 * Field maps are typed as string records here; `@pluginfinity/targets` checks
 * their totality over `SKILL_FIELDS` and `AGENT_FIELDS` at compile time and in
 * tests. A tool name absent from `tools.names` passes through unchanged.
 *
 * @public
 */
export const Target = Schema.Struct({
	manifest: Schema.Struct({
		path: Schema.String,
		format: ManifestFormat,
		schema: Schema.optionalKey(Schema.String),
		keys: Schema.Array(Schema.String),
	}),
	pluginRoot: Schema.Struct({ hooks: RootSpelling, mcp: RootSpelling, body: RootSpelling }),
	skills: Schema.Struct({ dir: Schema.String, fields: FieldMap, hostFields: Schema.Array(Schema.String) }),
	agents: Schema.Struct({
		dir: Schema.String,
		suffix: Schema.String,
		fields: FieldMap,
		hostFields: Schema.Array(Schema.String),
	}),
	hooks: Schema.Struct({
		path: Schema.String,
		format: HooksFormat,
		events: Schema.Record(Schema.String, EventMapping),
		ownEvents: Schema.Array(Schema.String),
	}),
	mcp: Schema.Struct({ path: Schema.String, format: McpFormat, schema: Schema.optionalKey(Schema.String) }),
	references: Schema.Struct({ style: Schema.Literals(["path", "prose"]) }),
	tools: Schema.Struct({ names: Schema.Record(Schema.String, ToolMapping), mcp: Schema.String }),
});

/** @public */
export type Target = typeof Target.Type;

/** @public */
export const keep: FieldMapEntry = { _tag: "keep" };

/** @public */
export const drop: FieldMapEntry = { _tag: "drop" };

/** @public */
export const rename = (to: string): FieldMapEntry => ({ _tag: "rename", to });

/** @public */
export const translate = (table: "tools"): FieldMapEntry => ({ _tag: "translate", table });

/** @public */
export const degrade = (form: DegradeForm): FieldMapEntry => ({ _tag: "degrade", form });

/** @public */
export const unresolved = (note: string): typeof Unresolved.Type => ({ _tag: "unresolved", note });

/** @public */
export const absent: typeof EventMapping.Type = { _tag: "absent" };
