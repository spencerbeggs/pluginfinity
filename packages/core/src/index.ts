/**
 * The platform-free pluginfinity domain model.
 *
 * @remarks
 * Holds the config schemas (plugin-wide fields, hooks, MCP servers and the
 * per-target override factory), skill and agent frontmatter in Claude Code's
 * field names, and the `Target` schema that describes a host by what it can do.
 *
 * @packageDocumentation
 */

export { BASE_CONFIG_KEYS, BaseConfigFields, PluginName, ScriptInvoke, makeTargetSetting } from "./config.js";
export type { AgentField, SkillField } from "./frontmatter.js";
export {
	AGENT_FIELDS,
	AgentFrontmatter,
	ComponentName,
	ComponentTargets,
	SKILL_FIELDS,
	SkillFrontmatter,
} from "./frontmatter.js";
export type { HooksFields } from "./hooks.js";
export {
	CLAUDE_HOOK_EVENTS,
	ClaudeHookEvent,
	CommandHook,
	HookEntries,
	HookEntry,
	HookFallback,
	Hooks,
	ScriptHook,
	makeHooks,
} from "./hooks.js";
export { McpServer, McpServers, RemoteMcpServer, StdioMcpServer } from "./mcp.js";
export type { DegradeForm } from "./target.js";
export {
	Absent,
	DEGRADE_FORMS,
	Degrade,
	Drop,
	EventMapping,
	FieldMapEntry,
	HOOKS_FORMATS,
	HooksFormat,
	Keep,
	MANIFEST_FORMATS,
	MCP_FORMATS,
	ManifestFormat,
	McpFormat,
	ModelMapping,
	Rename,
	RootSpelling,
	Target,
	ToolMapping,
	Translate,
	TranslateTable,
	Unresolved,
	absent,
	degrade,
	drop,
	keep,
	rename,
	translate,
	unresolved,
} from "./target.js";
export { CORE_VERSION } from "./version.js";
