import { Schema } from "effect";
import { PluginName } from "./config.js";

/**
 * A skill or agent name: kebab-case and at most 64 characters, the Agent
 * Skills spec rule and the strictest of the hosts.
 *
 * @public
 */
export const ComponentName = PluginName.check(Schema.isMaxLength(64));

/**
 * A component's per-target block: `false` leaves it out of that target, an
 * object holds fields for that host only. Keys are checked against the
 * registry when a plugin is read; the block is stripped on emit.
 *
 * @public
 */
export const ComponentTargets = Schema.Record(
	Schema.String,
	Schema.Union([Schema.Literal(false), Schema.Record(Schema.String, Schema.Unknown)]),
);

const ToolList = Schema.Union([Schema.String, Schema.Array(Schema.String)]);
const Effort = Schema.Literals(["low", "medium", "high", "xhigh", "max"]);
const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0));

/**
 * A skill's `SKILL.md` frontmatter, in Claude Code's field names.
 *
 * @public
 */
export const SkillFrontmatter = Schema.Struct({
	name: Schema.optionalKey(ComponentName),
	description: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1024)),
	license: Schema.optionalKey(Schema.String),
	compatibility: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(500))),
	metadata: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
	"allowed-tools": Schema.optionalKey(ToolList),
	"disallowed-tools": Schema.optionalKey(ToolList),
	when_to_use: Schema.optionalKey(Schema.String),
	"argument-hint": Schema.optionalKey(Schema.String),
	arguments: Schema.optionalKey(ToolList),
	"disable-model-invocation": Schema.optionalKey(Schema.Boolean),
	"user-invocable": Schema.optionalKey(Schema.Boolean),
	model: Schema.optionalKey(Schema.String),
	effort: Schema.optionalKey(Effort),
	context: Schema.optionalKey(Schema.Literal("fork")),
	agent: Schema.optionalKey(Schema.String),
	background: Schema.optionalKey(Schema.Boolean),
	hooks: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
	paths: Schema.optionalKey(ToolList),
	shell: Schema.optionalKey(Schema.Literals(["bash", "powershell"])),
	targets: Schema.optionalKey(ComponentTargets),
});

/**
 * An agent file's frontmatter, in Claude Code's field names.
 *
 * @public
 */
export const AgentFrontmatter = Schema.Struct({
	name: ComponentName,
	description: Schema.String.check(Schema.isMinLength(1)),
	tools: Schema.optionalKey(ToolList),
	disallowedTools: Schema.optionalKey(ToolList),
	model: Schema.optionalKey(Schema.String),
	effort: Schema.optionalKey(Effort),
	permissionMode: Schema.optionalKey(
		Schema.Literals(["default", "acceptEdits", "auto", "dontAsk", "bypassPermissions", "plan", "manual"]),
	),
	maxTurns: Schema.optionalKey(PositiveInt),
	skills: Schema.optionalKey(Schema.Array(Schema.String)),
	mcpServers: Schema.optionalKey(
		Schema.Array(Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.Unknown)])),
	),
	hooks: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
	memory: Schema.optionalKey(Schema.Literals(["user", "project", "local"])),
	background: Schema.optionalKey(Schema.Boolean),
	omitClaudeMd: Schema.optionalKey(Schema.Boolean),
	isolation: Schema.optionalKey(Schema.Literal("worktree")),
	color: Schema.optionalKey(Schema.Literals(["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"])),
	initialPrompt: Schema.optionalKey(Schema.String),
	experimental: Schema.optionalKey(Schema.Struct({ cacheTtl: Schema.optionalKey(Schema.Literals(["5m", "1h"])) })),
	targets: Schema.optionalKey(ComponentTargets),
});

/**
 * A skill frontmatter field every target's field map must cover.
 *
 * @public
 */
export type SkillField = Exclude<keyof typeof SkillFrontmatter.fields, "targets">;

/**
 * An agent frontmatter field every target's field map must cover.
 *
 * @public
 */
export type AgentField = Exclude<keyof typeof AgentFrontmatter.fields, "targets">;

/**
 * Every skill frontmatter field except `targets`.
 *
 * @public
 */
export const SKILL_FIELDS = Object.keys(SkillFrontmatter.fields).filter(
	(key) => key !== "targets",
) as ReadonlyArray<SkillField>;

/**
 * Every agent frontmatter field except `targets`.
 *
 * @public
 */
export const AGENT_FIELDS = Object.keys(AgentFrontmatter.fields).filter(
	(key) => key !== "targets",
) as ReadonlyArray<AgentField>;
