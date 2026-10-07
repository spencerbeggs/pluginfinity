/**
 * The pluginfinity build pipeline shared by every pluginfinity front end.
 *
 * @remarks
 * Config discovery and loading, the `doctor` program, and `build` and
 * `validate`. Reads no `process`: a front end passes the start directory and
 * the Node.js version down. Builds emit each target's manifest, hooks, skills and
 * agents; MCP servers follow.
 *
 * @packageDocumentation
 */

export type { RenderedAgent, SourceAgent } from "./agents.js";
export { readAgents, renderAgent } from "./agents.js";
export type { HostBlockProblem } from "./body.js";
export { applyHostBlocks } from "./body.js";
export { CONFIG_FILE_NAMES, ConfigDiscovery } from "./discovery.js";
export type { DoctorInput } from "./doctor.js";
export {
	CheckGroup,
	CheckSeverity,
	CheckStatus,
	DEFAULT_CHECK_TIMEOUT,
	DoctorCheck,
	DoctorReport,
	NODE_FLOOR,
	runDoctor,
} from "./doctor.js";
export type { EmittedFile } from "./emit.js";
export { EmitPlan, GENERATED_MODE, applyEmit, planEmit } from "./emit.js";
export {
	ENV_RUNNER_TIMEOUT,
	ENV_SETUP_TIMEOUT,
	ENV_WAIT_TIMEOUT_FLOOR,
	envLibFiles,
	envNotes,
	envRunnerEntry,
	envWaitNotes,
	renderEnvLib,
	withEnvRunner,
} from "./env.js";
export type { BuildError, ConfigError } from "./errors.js";
export {
	BuildStale,
	ComponentInvalid,
	ComponentsInvalid,
	ConfigAmbiguous,
	ConfigInvalid,
	ConfigIssue,
	ConfigLoadFailed,
	ConfigNotFound,
	HookEventUnsupported,
	HookScriptInvalid,
	HookScriptProblem,
	HostRejected,
	NotImplemented,
	PackageVersionMissing,
	PathConflict,
	ShippedFileInvalid,
	ShippedFileProblem,
	TargetDrift,
	TargetNotEnabled,
	UnknownTarget,
	isBuildError,
	isConfigError,
} from "./errors.js";
export type { FieldDrop, MappedFrontmatter, OwnMcp, SplitMarkdown, UnresolvedField } from "./frontmatter.js";
export { appendSections, mapFrontmatter, splitFrontmatter } from "./frontmatter.js";
export type { TargetHookEvent, UnsupportedHookEvent } from "./hooks.js";
export {
	commandFiles,
	entryEnv,
	hookCommand,
	hookCommandFiles,
	hookExec,
	hookScripts,
	renderHooks,
	shellEnvPrefix,
	targetHooks,
} from "./hooks.js";
export type { LoadedConfig } from "./loader.js";
export { ConfigLoader } from "./loader.js";
export type { LogEntry, LogFileName, LogTail, RawLogLine } from "./logs.js";
export {
	configPluginNames,
	listLogPlugins,
	logDirectory,
	logRoot,
	parseLogLine,
	readLog,
	readLogFrom,
} from "./logs.js";
export type { Manifest } from "./manifest.js";
export { renderManifest, serializeManifest } from "./manifest.js";
export type { MonitorContext, MonitorMap, RenderedMonitors } from "./monitors.js";
export { renderMonitors, targetMonitors } from "./monitors.js";
export type { BuildNote, BuildNoteKind } from "./notes.js";
export { BUILD_NOTE_KINDS } from "./notes.js";
export type { BuildInput, PlanError, TargetBuild, TargetValidation, ValidateInput } from "./operations.js";
export { build, validate } from "./operations.js";
export type { ConfigSelection, PreparedPlugin } from "./selection.js";
export { preparePlugins, selectConfigPaths } from "./selection.js";
export type { ServerFiles, ServerRender } from "./servers.js";
export { renderServers, serverFiles } from "./servers.js";
export type { RenderedSkill, SourceSkill } from "./skills.js";
export { SKILL_DESCRIPTION_MAX, readSkills, renderSkill } from "./skills.js";
export type { TokenContext, TokenProblem } from "./tokens.js";
export { renderTokens } from "./tokens.js";
export { ToolDiscoveryLive } from "./tools.js";
export { ENGINE_VERSION } from "./version.js";
