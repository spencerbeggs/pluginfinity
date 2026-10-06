import type { Target } from "@pluginfinity/core";
import type { KnownTargetId } from "@pluginfinity/targets";
import type { TargetHookEvent } from "./hooks.js";
import type { BuildNote } from "./notes.js";

/** The hook library helpers whose output a host may ignore, by the `hooks.output` key that says where it is honoured. */
const HELPERS = [
	{ helper: "hook_context", kind: "context" },
	{ helper: "hook_system_message", kind: "system_message" },
] as const;

/**
 * The script text without its `#` comments: a `#` that starts a word outside
 * a quoted string ends the line. Best effort, line by line: a quote left open
 * across lines, a heredoc body and `$#` are not modelled.
 */
const stripComments = (script: string): string =>
	script
		.split("\n")
		.map((line) => {
			let quote: string | undefined;
			for (let index = 0; index < line.length; index++) {
				const char = line.charAt(index);
				if (quote !== undefined) {
					if (char === "\\" && quote === '"') index++;
					else if (char === quote) quote = undefined;
				} else if (char === "\\") {
					index++;
				} else if (char === "'" || char === '"') {
					quote = char;
				} else if (char === "#" && (index === 0 || /\s/.test(line.charAt(index - 1)))) {
					return line.slice(0, index);
				}
			}
			return line;
		})
		.join("\n");

/** Whether `helper` appears in `text` as a whole word. */
const callsHelper = (text: string, helper: string): boolean =>
	new RegExp(`(?<![A-Za-z0-9_])${helper}(?![A-Za-z0-9_])`).test(text);

/**
 * The `hook-output-ignored` notes for a target's hook scripts: each `script`
 * entry that calls `hook_context` or `hook_system_message` on an event where
 * the host ignores that output (`target.hooks.output`).
 *
 * Best effort: it reads the script text, strips comments and looks for the
 * helper names as words, so it cannot see a call made through a variable or a
 * sourced file, and it cannot tell a call on a branch that never runs. An
 * event the target owns (one outside the Claude event table) is skipped, since
 * the table says nothing about it. A script `read` returns `undefined` for is
 * skipped.
 *
 * @param id - The target's id, which each note names.
 * @param target - The target description.
 * @param events - The target's hook events, as `targetHooks` returns them.
 * @param read - The source text of a plugin-relative script path.
 */
export const ignoredOutput = (
	id: KnownTargetId,
	target: Target,
	events: ReadonlyArray<TargetHookEvent>,
	read: (script: string) => string | undefined,
): ReadonlyArray<BuildNote> => {
	const notes: Array<BuildNote> = [];
	for (const { event, entries } of events) {
		if (target.hooks.ownEvents.includes(event)) continue;
		for (const entry of entries) {
			if (!("script" in entry)) continue;
			const source = read(entry.script);
			if (source === undefined) continue;
			const text = stripComments(source);
			for (const { helper, kind } of HELPERS) {
				if (!target.hooks.output[kind].includes(event) && callsHelper(text, helper)) {
					notes.push({ target: id, path: entry.script, kind: "hook-output-ignored", name: `${event}:${helper}` });
				}
			}
		}
	}
	return notes;
};
