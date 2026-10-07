// Reading the logs the shipped log library writes: where they live, how a line
// parses, the last lines of a file and what was appended since an offset. A
// front end passes the state directory down (no `process` read here) and
// decides how to draw and follow what comes back.

import type { PlatformError } from "effect";
import { Effect, FileSystem, Path } from "effect";
import type { ConfigError } from "./errors.js";
import { pluginName } from "./manifest.js";
import type { ConfigSelection } from "./selection.js";
import { preparePlugins } from "./selection.js";

/**
 * The two files a plugin's components log to.
 *
 * @public
 */
export type LogFileName = "error.log" | "debug.log";

/**
 * One parsed log line: `<ISO-8601 UTC> [<host>] <component>/<script>: <message>`.
 *
 * @public
 */
export interface LogEntry {
	readonly ts: string;
	readonly host: string;
	readonly component: "hook" | "server" | "monitor" | "script";
	readonly script: string;
	readonly message: string;
	readonly plugin: string;
	readonly file: LogFileName;
}

/**
 * A line that does not follow the standard, carried through whole.
 *
 * @public
 */
export interface RawLogLine {
	readonly raw: string;
	readonly plugin: string;
	readonly file: LogFileName;
}

const LINE =
	/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) \[([^\]]*)\] (hook|server|monitor|script)\/([^:]*): (.*)$/;

/**
 * Parse one log line, or carry it through as raw when it does not follow the
 * standard.
 *
 * @public
 */
export const parseLogLine = (line: string, plugin: string, file: LogFileName): LogEntry | RawLogLine => {
	const match = LINE.exec(line);
	if (match === null) return { raw: line, plugin, file };
	return {
		ts: match[1] as string,
		host: match[2] as string,
		component: match[3] as LogEntry["component"],
		script: match[4] as string,
		message: match[5] as string,
		plugin,
		file,
	};
};

/**
 * The directory every plugin's logs live under: `<stateHome>/pluginfinity`.
 *
 * @public
 */
export const logRoot = (stateHome: string): Effect.Effect<string, never, Path.Path> =>
	Effect.map(Path.Path, (path) => path.join(stateHome, "pluginfinity"));

/**
 * One plugin's log directory: `<stateHome>/pluginfinity/<plugin>`.
 *
 * @public
 */
export const logDirectory = (stateHome: string, plugin: string): Effect.Effect<string, never, Path.Path> =>
	Effect.gen(function* () {
		const path = yield* Path.Path;
		return path.join(yield* logRoot(stateHome), plugin);
	});

/**
 * The plugin names that have a log directory, sorted; none when the state
 * directory does not exist.
 *
 * @public
 */
export const listLogPlugins = (
	stateHome: string,
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const root = yield* logRoot(stateHome);
		if (!(yield* fs.exists(root))) return [];
		const names: Array<string> = [];
		for (const entry of yield* fs.readDirectory(root)) {
			if ((yield* fs.stat(path.join(root, entry))).type === "Directory") names.push(entry);
		}
		return names.sort();
	});

/**
 * The names the selected config's targets publish under: the config's `name`
 * and each target's own `name` override, deduplicated, in first-seen order.
 * Each target's components log under its own name.
 *
 * @public
 */
export const configPluginNames = (
	selection: ConfigSelection,
): Effect.Effect<ReadonlyArray<string>, ConfigError, FileSystem.FileSystem | Path.Path> =>
	Effect.map(preparePlugins({ selection, targets: [] }), (prepared) => [
		...new Set(prepared.flatMap(({ config, targets }) => targets.map((id) => pluginName(config.config, id)))),
	]);

/**
 * The tail of one log file.
 *
 * @public
 */
export interface LogTail {
	readonly plugin: string;
	readonly file: LogFileName;
	/** The file's absolute path, whether or not it exists. */
	readonly path: string;
	/** Whether the file exists. */
	readonly present: boolean;
	/** The last lines asked for, oldest first. */
	readonly lines: ReadonlyArray<string>;
	/** The byte offset after the last complete line: where {@link readLogFrom} resumes. */
	readonly offset: number;
}

const DECODER = new TextDecoder();
const NEWLINE = 10;

/** The complete lines in `bytes` and how many bytes they cover; a last line with no newline is held back. */
const completeLines = (bytes: Uint8Array): { readonly lines: ReadonlyArray<string>; readonly length: number } => {
	const end = bytes.lastIndexOf(NEWLINE) + 1;
	if (end === 0) return { lines: [], length: 0 };
	const text = DECODER.decode(bytes.subarray(0, end));
	return { lines: text.replace(/\r?\n$/, "").split(/\r?\n/), length: end };
};

/**
 * The last `lines` complete lines of a plugin's log file.
 *
 * @remarks
 * An absent file is `present: false` with no lines, not a failure: a plugin
 * that has logged nothing has no file.
 *
 * @public
 */
export const readLog = (input: {
	readonly stateHome: string;
	readonly plugin: string;
	readonly file: LogFileName;
	readonly lines: number;
}): Effect.Effect<LogTail, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = (yield* Path.Path).join(yield* logDirectory(input.stateHome, input.plugin), input.file);
		if (!(yield* fs.exists(path))) {
			return { plugin: input.plugin, file: input.file, path, present: false, lines: [], offset: 0 };
		}
		const { lines, length } = completeLines(yield* fs.readFile(path));
		return {
			plugin: input.plugin,
			file: input.file,
			path,
			present: true,
			lines: input.lines <= 0 ? [] : lines.slice(-input.lines),
			offset: length,
		};
	});

/**
 * The complete lines appended to `path` after byte `offset`, and the offset to
 * resume from.
 *
 * @remarks
 * A file smaller than `offset` was truncated or replaced, so reading restarts
 * from its beginning. A file that does not exist yields no lines at offset 0.
 *
 * @public
 */
export const readLogFrom = (
	path: string,
	offset: number,
): Effect.Effect<
	{ readonly lines: ReadonlyArray<string>; readonly offset: number },
	PlatformError.PlatformError,
	FileSystem.FileSystem
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		if (!(yield* fs.exists(path))) return { lines: [], offset: 0 };
		const size = Number((yield* fs.stat(path)).size);
		const from = size < offset ? 0 : offset;
		if (size === from) return { lines: [], offset: from };
		const { lines, length } = completeLines((yield* fs.readFile(path)).subarray(from));
		return { lines, offset: from + length };
	});
