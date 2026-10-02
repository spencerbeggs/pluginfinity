/**
 * The platform-free pluginfinity domain model.
 *
 * @remarks
 * Holds the plugin-wide config fields and the per-target override shape.
 * The plugin source model and the `Target` capability schema land here in
 * the design phase.
 *
 * @packageDocumentation
 */

export { BASE_CONFIG_KEYS, BaseConfigFields, PluginName, TargetOverride, TargetSetting } from "./config.js";
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
	DEGRADE_FORMS,
	EventMapping,
	FieldMapEntry,
	HOOKS_FORMATS,
	HooksFormat,
	MANIFEST_FORMATS,
	MCP_FORMATS,
	ManifestFormat,
	McpFormat,
	RootSpelling,
	Target,
	ToolMapping,
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
