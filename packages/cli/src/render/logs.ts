// The logs result, drawn for its audience: headed sections of raw lines for
// people, one JSON object (or one entry per line while following) for agents
// and CI.

import type { LogEntry, LogFileName, LogTail, RawLogLine } from "@pluginfinity/engine";
import { ENGINE_VERSION, parseLogLine } from "@pluginfinity/engine";

/** What `logs` read: the log root and the tail of each selected file. */
export interface LogsView {
	/** `<state>/pluginfinity`: where every plugin's logs live. */
	readonly root: string;
	/** Whether `root` exists. */
	readonly rootExists: boolean;
	readonly tails: ReadonlyArray<LogTail>;
}

/** The header that opens a file's section. */
export const sectionHeader = (plugin: string, file: LogFileName): string => `==> ${plugin}/${file} <==`;

const absentLine = (file: LogFileName): string =>
	file === "debug.log"
		? "  (no debug.log; set PLUGINFINITY_DEBUG=1 to write one)"
		: "  (no error.log yet; nothing has been logged)";

/** Whether anything was found to show: a log root with at least one selected plugin. */
export const isFound = (view: LogsView): boolean => view.rootExists && view.tails.length > 0;

/** The lines a person reads: the directory, then a headed section per file. */
export const logsLines = (view: LogsView): ReadonlyArray<string> => {
	if (!isFound(view)) {
		return [
			`No logs yet: ${view.root} ${view.rootExists ? "has no plugin directories" : "does not exist"}.`,
			"A plugin's components write there when they log an error; set PLUGINFINITY_DEBUG=1 to write debug.log too.",
		];
	}
	return [
		`Logs in ${view.root}`,
		...view.tails.flatMap((tail) => [
			sectionHeader(tail.plugin, tail.file),
			...(!tail.present ? [absentLine(tail.file)] : tail.lines.length === 0 ? ["  (no entries)"] : tail.lines),
		]),
	];
};

/** One entry as `--agent` and `--ci` read it. */
export const entryJson = (entry: LogEntry | RawLogLine): string => JSON.stringify(entry);

/** The entries of every tail, parsed, oldest first within each file. */
export const tailEntries = (tails: ReadonlyArray<LogTail>): ReadonlyArray<LogEntry | RawLogLine> =>
	tails.flatMap((tail) => tail.lines.map((line) => parseLogLine(line, tail.plugin, tail.file)));

/** The one JSON object a non-following `logs` prints for agents and CI. */
export const logsJson = (view: LogsView, distribution: unknown): string =>
	JSON.stringify({
		engine_version: ENGINE_VERSION,
		distribution,
		ok: true,
		directory: view.root,
		found: isFound(view),
		files: view.tails.map((tail) => ({ plugin: tail.plugin, file: tail.file, path: tail.path, present: tail.present })),
		entries: tailEntries(view.tails),
	});
