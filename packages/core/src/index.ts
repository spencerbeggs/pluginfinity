/**
 * The platform-free pluginfinity domain model.
 *
 * @remarks
 * Holds the config schemas (plugin-wide fields, hooks, MCP and LSP servers and the
 * per-target override factory), skill and agent frontmatter in Claude Code's
 * field names, and the `Target` schema that describes a host by what it can do.
 *
 * @packageDocumentation
 */

export {
	BASE_CONFIG_KEYS,
	BaseConfigFields,
	PluginName,
	ScriptInvoke,
	ShippedPath,
	makeTargetSetting,
} from "./config.js";
export { EnvConfig, EnvVar, EnvVarName } from "./env.js";
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
	PluginRelativePath,
	ScriptHook,
	makeHooks,
} from "./hooks.js";
export type { LspField } from "./lsp.js";
export { LSP_FIELDS, LspServer, LspServers } from "./lsp.js";
export { McpServer, McpServers, RemoteMcpServer, ServerEnv, StdioMcpServer } from "./mcp.js";
export { CommandMonitor, MonitorEntry, MonitorName, MonitorWhen, Monitors, ScriptMonitor } from "./monitors.js";
export { KebabName } from "./name.js";
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
	InFile,
	InManifest,
	Keep,
	LSP_FORMATS,
	LspFormat,
	MANIFEST_FORMATS,
	MCP_FORMATS,
	ManifestFormat,
	McpFormat,
	Rename,
	RootSpelling,
	ServerPlacement,
	Target,
	ToolMapping,
	Translate,
	TranslateTable,
	Unresolved,
	ValueMapping,
	absent,
	degrade,
	drop,
	inFile,
	inManifest,
	keep,
	rename,
	translate,
	unresolved,
} from "./target.js";
export { CORE_VERSION } from "./version.js";
