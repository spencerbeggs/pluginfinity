/**
 * The pluginfinity build pipeline shared by every pluginfinity front end.
 *
 * @remarks
 * Config discovery and loading, the `doctor` program, and the front half of
 * `build` and `validate`. Reads no `process`: a front end passes the start
 * directory and the Node.js version down. The read, transform, emit and
 * check stages land with the `Target` capability schema.
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
export type { ConfigError } from "./errors.js";
export {
	ConfigAmbiguous,
	ConfigInvalid,
	ConfigIssue,
	ConfigLoadFailed,
	ConfigNotFound,
	NotImplemented,
	TargetNotEnabled,
	UnknownTarget,
	isConfigError,
} from "./errors.js";
export type { LoadedConfig } from "./loader.js";
export { ConfigLoader } from "./loader.js";
export type { BuildInput, ValidateInput } from "./operations.js";
export { build, validate } from "./operations.js";
export type { ConfigSelection, PreparedPlugin } from "./selection.js";
export { preparePlugins, selectConfigPaths } from "./selection.js";
export { ToolDiscoveryLive } from "./tools.js";
export { ENGINE_VERSION } from "./version.js";
