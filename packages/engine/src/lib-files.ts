import type { KnownTargetId } from "@pluginfinity/targets";
import type { EmittedFile } from "./emit.js";
import { renderHostFile } from "./hook-lib.js";
import { LOG_LIB_FILES } from "./log-lib.generated.js";
import { MONITOR_LIB_FILES } from "./monitor-lib.generated.js";

/**
 * Where every build gets the shared libraries (`log.sh`, `host.sh`, the server library when
 * there is a local server, and `monitor.sh` when a target has monitors), relative to the build root.
 *
 * @public
 */
export const LIB_DIR = "lib/pluginfinity";

/**
 * The files every build carries under `lib/pluginfinity`: the logging library and the
 * generated `host.sh` that names the host and plugin.
 *
 * @public
 */
export const libFiles = (
	host: KnownTargetId,
	plugin: string,
	version: string,
	options: { readonly monitors: boolean },
): ReadonlyArray<EmittedFile> => [
	...LOG_LIB_FILES.map((file) => ({ path: `${LIB_DIR}/${file.name}`, content: file.content })),
	{ path: `${LIB_DIR}/host.sh`, content: renderHostFile(host, plugin, version) },
	...(options.monitors
		? MONITOR_LIB_FILES.map((file) => ({ path: `${LIB_DIR}/${file.name}`, content: file.content }))
		: []),
];
