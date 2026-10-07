import type { EnvConfig } from "@pluginfinity/core";
import type { KnownTargetId } from "@pluginfinity/targets";
import type { EmittedFile } from "./emit.js";
import { envLibFiles } from "./env.js";
import { renderHostFile } from "./hook-lib.js";
import { LOG_LIB_FILES } from "./log-lib.generated.js";
import { MONITOR_LIB_FILES } from "./monitor-lib.generated.js";

/**
 * Where every build gets the shared libraries (`log.sh`, `host.sh`, the server library when
 * there is a local server, `monitor.sh` when a target has monitors, and `env.sh` with its
 * runner `env-run.sh` when the config declares `env`), relative to the build root.
 *
 * @public
 */
export const LIB_DIR = "lib/pluginfinity";

/**
 * The files every build carries under `lib/pluginfinity`: the logging library and the
 * generated `host.sh` that names the host and plugin, plus the monitor library when the
 * target has monitors and the session env library when the config declares `env`.
 *
 * @public
 */
export const libFiles = (
	host: KnownTargetId,
	plugin: string,
	version: string,
	options: { readonly monitors: boolean; readonly env?: EnvConfig },
): ReadonlyArray<EmittedFile> => [
	...LOG_LIB_FILES.map((file) => ({ path: `${LIB_DIR}/${file.name}`, content: file.content })),
	{ path: `${LIB_DIR}/host.sh`, content: renderHostFile(host, plugin, version) },
	...(options.monitors
		? MONITOR_LIB_FILES.map((file) => ({ path: `${LIB_DIR}/${file.name}`, content: file.content }))
		: []),
	...(options.env === undefined ? [] : envLibFiles(options.env, LIB_DIR)),
];
