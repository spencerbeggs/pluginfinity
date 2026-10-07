import type { EmittedFile } from "./emit.js";
import { LIB_DIR } from "./lib-files.js";
import { SERVER_LIB_FILES } from "./server-lib.generated.js";

/**
 * Where every build that has a local server gets the server library, relative to the build root.
 *
 * @public
 */
export const SERVER_LIB_DIR = LIB_DIR;

/**
 * The server library, as one target's build writes it. `log.sh` and `host.sh` come from `libFiles`.
 *
 * @public
 */
export const serverLibFiles = (): ReadonlyArray<EmittedFile> =>
	SERVER_LIB_FILES.map((file) => ({ path: `${SERVER_LIB_DIR}/${file.name}`, content: file.content }));
