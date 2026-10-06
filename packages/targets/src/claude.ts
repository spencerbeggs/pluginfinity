import type { AgentField, FieldMapEntry, LspField, SkillField } from "@pluginfinity/core";
import { CLAUDE_HOOK_EVENTS, LSP_FIELDS, Target, drop, inManifest, keep } from "@pluginfinity/core";

const ROOT = `\${CLAUDE_PLUGIN_ROOT}`;

const skillFields = {
	name: keep,
	description: keep,
	license: keep,
	compatibility: keep,
	metadata: keep,
	"allowed-tools": keep,
	"disallowed-tools": keep,
	when_to_use: keep,
	"argument-hint": keep,
	arguments: keep,
	"disable-model-invocation": keep,
	"user-invocable": keep,
	model: keep,
	effort: keep,
	context: keep,
	agent: keep,
	background: keep,
	hooks: keep,
	paths: keep,
	shell: keep,
} as const satisfies Record<SkillField, FieldMapEntry>;

// Claude Code ignores permissionMode, hooks, mcpServers and initialPrompt on
// agents a plugin ships, so they are dropped rather than written to no effect.
const agentFields = {
	name: keep,
	description: keep,
	tools: keep,
	disallowedTools: keep,
	model: keep,
	effort: keep,
	permissionMode: drop,
	maxTurns: keep,
	skills: keep,
	mcpServers: drop,
	hooks: drop,
	memory: keep,
	background: keep,
	omitClaudeMd: keep,
	isolation: keep,
	color: keep,
	initialPrompt: drop,
	experimental: keep,
} as const satisfies Record<AgentField, FieldMapEntry>;

const lspFields = Object.fromEntries(LSP_FIELDS.map((field) => [field, keep])) as Record<LspField, FieldMapEntry>;

/**
 * Claude Code, described by what it can do.
 *
 * @public
 */
export const CLAUDE: Target = Target.make({
	manifest: {
		path: ".claude-plugin/plugin.json",
		format: "claude-plugin-json",
		keys: [
			"name",
			"version",
			"description",
			"author",
			"homepage",
			"repository",
			"license",
			"keywords",
			"mcpServers",
			"lspServers",
		],
	},
	pluginRoot: { hooks: ROOT, mcp: ROOT, lsp: ROOT, body: ROOT },
	skills: { dir: "skills", fields: skillFields, hostFields: [], invoke: "/{plugin}:{skill}" },
	agents: { dir: "agents", suffix: ".md", fields: agentFields, hostFields: [], id: "{plugin}:{agent}" },
	hooks: {
		path: "hooks/hooks.json",
		format: "claude-hooks-json",
		events: Object.fromEntries(CLAUDE_HOOK_EVENTS.map((event) => [event, event])),
		ownEvents: [],
	},
	// Servers go inline in plugin.json, not in a root .mcp.json or .lsp.json: repos conventionally gitignore
	// .mcp.json as local dev config, so a committed build would silently ship no MCP server.
	mcp: { placement: inManifest("mcpServers"), format: "claude-mcp-servers" },
	lsp: { placement: inManifest("lspServers"), format: "claude-lsp-servers", fields: lspFields },
	references: { style: "path" },
	tools: {
		names: {},
		mcp: "mcp__{server}__{tool}",
		unlisted: "keep",
		runtime: { names: {}, mcp: "mcp__plugin_{plugin}_{server}__{tool}", unlisted: "keep" },
	},
	models: {},
	efforts: {},
});
