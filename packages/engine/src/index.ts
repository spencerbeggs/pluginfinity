/**
 * The pluginfinity build pipeline shared by every pluginfinity front end.
 *
 * @remarks
 * Config discovery and loading, the `doctor` program, and `build` and
 * `validate`. Reads no `process`: a front end passes the start directory and
 * the Node.js version down. Builds emit each target's manifest so far; skills,
 * agents, hooks and MCP servers follow.
 *
 * @packageDocumentation
 */

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
export type { BuildError, ConfigError } from "./errors.js";
export {
	BuildStale,
	ConfigAmbiguous,
	ConfigInvalid,
	ConfigIssue,
	ConfigLoadFailed,
	ConfigNotFound,
	HostRejected,
	NotImplemented,
	PackageVersionMissing,
	TargetDrift,
	TargetNotEnabled,
	UnknownTarget,
	isBuildError,
	isConfigError,
} from "./errors.js";
export type { LoadedConfig } from "./loader.js";
export { ConfigLoader } from "./loader.js";
export type { Manifest } from "./manifest.js";
export { renderManifest, serializeManifest } from "./manifest.js";
export type { BuildInput, TargetBuild, TargetValidation, ValidateInput } from "./operations.js";
export { build, validate } from "./operations.js";
export type { ConfigSelection, PreparedPlugin } from "./selection.js";
export { preparePlugins, selectConfigPaths } from "./selection.js";
export { ToolDiscoveryLive } from "./tools.js";
export { ENGINE_VERSION } from "./version.js";
