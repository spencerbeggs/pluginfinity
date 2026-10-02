import type { AgentField, ClaudeHookEvent, FieldMapEntry, SkillField } from "@pluginfinity/core";
import {
	CLAUDE_HOOK_EVENTS,
	Target,
	absent,
	degrade,
	drop,
	keep,
	rename,
	translate,
	unresolved,
} from "@pluginfinity/core";

const ROOT = `\${PLUGIN_ROOT}`;

/**
 * Copilot's own hook events: the ones with no Claude Code counterpart.
 * `SubagentStart` and `Notification` are not here; authors write the Claude
 * names and the event table maps them to their camelCase Copilot names.
 *
 * @public
 */
export const COPILOT_OWN_EVENTS = ["userPromptTransformed", "errorOccurred"] as const;

const skillFields = {
	name: keep,
	description: keep,
	license: keep,
	compatibility: unresolved("Copilot does not document the Agent Skills compatibility field"),
	metadata: unresolved("Copilot does not document the Agent Skills metadata field"),
	"allowed-tools": translate("tools"),
	"disallowed-tools": drop,
	when_to_use: degrade("description-suffix"),
	"argument-hint": keep,
	arguments: drop,
	"disable-model-invocation": keep,
	"user-invocable": keep,
	model: drop,
	effort: drop,
	context: drop,
	agent: drop,
	background: drop,
	hooks: drop,
	paths: degrade("description-suffix"),
	shell: drop,
} as const satisfies Record<SkillField, FieldMapEntry>;

const agentFields = {
	name: keep,
	description: keep,
	tools: translate("tools"),
	disallowedTools: drop,
	model: keep,
	effort: rename("reasoningEffort"),
	permissionMode: drop,
	maxTurns: drop,
	skills: degrade("body-section"),
	mcpServers: unresolved(
		"Claude mcpServers lists names or inline configs; Copilot mcp-servers is an object of configs. Set mcp-servers under targets.copilot",
	),
	hooks: drop,
	memory: drop,
	background: drop,
	omitClaudeMd: drop,
	isolation: drop,
	color: drop,
	initialPrompt: drop,
	experimental: drop,
} as const satisfies Record<AgentField, FieldMapEntry>;

// Events with a PascalCase form on Copilot keep their Claude name, so a hook
// script reads a Claude-shaped payload. SubagentStart and Notification exist
// only in camelCase; everything else is absent.
const PASCAL_CASE = new Set<ClaudeHookEvent>([
	"SessionStart",
	"SessionEnd",
	"UserPromptSubmit",
	"PreToolUse",
	"PostToolUse",
	"PostToolUseFailure",
	"PermissionRequest",
	"Stop",
	"SubagentStop",
	"PreCompact",
]);
const CAMEL_CASE: Partial<Record<ClaudeHookEvent, string>> = {
	SubagentStart: "subagentStart",
	Notification: "notification",
};

/**
 * GitHub Copilot CLI, emitting Agent Plugins 1.0, described by what it can do.
 *
 * @public
 */
export const COPILOT: Target = Target.make({
	manifest: {
		path: "plugin.json",
		format: "agent-plugins-1.0",
		schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
		keys: ["$schema", "name", "version", "description", "author", "homepage", "repository", "license", "keywords"],
	},
	pluginRoot: {
		hooks: ROOT,
		mcp: ROOT,
		body: unresolved("Copilot documents no plugin-root expansion inside skill or agent bodies"),
	},
	skills: { dir: "skills", fields: skillFields, hostFields: [] },
	agents: {
		dir: "com.github.copilot/agents",
		suffix: ".agent.md",
		fields: agentFields,
		hostFields: [
			"target",
			"metadata",
			"models",
			"modelPolicy",
			"include-custom-instructions",
			"disable-model-invocation",
			"user-invocable",
			"mcp-servers",
			"handoffs",
			"argument-hint",
			"agents",
		],
	},
	hooks: {
		path: "com.github.copilot/hooks/hooks.json",
		format: "copilot-hooks-v1",
		events: Object.fromEntries(
			CLAUDE_HOOK_EVENTS.map((event) => [event, PASCAL_CASE.has(event) ? event : (CAMEL_CASE[event] ?? absent)]),
		),
		ownEvents: [...COPILOT_OWN_EVENTS],
	},
	mcp: {
		path: "mcp.json",
		format: "agent-plugins-mcp-1.0",
		schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
	},
	references: { style: "prose" },
	tools: {
		names: {
			Agent: "agent",
			Skill: unresolved("Copilot documents no alias for Claude Code's Skill tool"),
		},
		mcp: "{server}/{tool}",
	},
});
