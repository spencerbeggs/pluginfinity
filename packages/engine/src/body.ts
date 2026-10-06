/**
 * The markers of a host block: a line holding only
 * `<!-- pluginfinity:only <id> [<id>…] -->` opens one, and a line holding only
 * `<!-- /pluginfinity:only -->` closes it. A marker inside fenced code or an
 * inline code span is text, so a body can show one.
 */
const OPEN = /^\s*<!--\s*pluginfinity:only\s+([^>]*?)\s*-->\s*$/;
const CLOSE = /^\s*<!--\s*\/pluginfinity:only\s*-->\s*$/;
const MARKER = /<!--\s*\/?pluginfinity:only/;
export const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * The inline code spans of one line, as sorted, disjoint `[start, end)` ranges
 * covering the backticks too. A span opens at a run of backticks and closes at
 * the next run of exactly the same length; a run with no such partner is
 * literal text. One pass over the line: runs are indexed, then each is paired
 * with the next run of its length, so no input backtracks.
 */
export const inlineCodeSpans = (line: string): ReadonlyArray<{ readonly start: number; readonly end: number }> => {
	const starts: Array<number> = [];
	const lengths: Array<number> = [];
	for (let i = 0; i < line.length; ) {
		if (line[i] !== "`") {
			i++;
			continue;
		}
		let j = i;
		while (line[j] === "`") j++;
		starts.push(i);
		lengths.push(j - i);
		i = j;
	}
	const partner: Array<number> = new Array<number>(starts.length).fill(-1);
	const nextOfLength = new Map<number, number>();
	for (let k = starts.length - 1; k >= 0; k--) {
		const len = lengths[k] as number;
		partner[k] = nextOfLength.get(len) ?? -1;
		nextOfLength.set(len, k);
	}
	const spans: Array<{ start: number; end: number }> = [];
	for (let k = 0; k < starts.length; ) {
		const close = partner[k] as number;
		if (close === -1) {
			k++;
			continue;
		}
		spans.push({ start: starts[k] as number, end: (starts[close] as number) + (lengths[close] as number) });
		k = close + 1;
	}
	return spans;
};

/** The line with its inline code spans removed. */
export const stripInlineCode = (line: string): string => {
	let out = "";
	let at = 0;
	for (const { start, end } of inlineCodeSpans(line)) {
		out += line.slice(at, start);
		at = end;
	}
	return out + line.slice(at);
};

/**
 * Why a body's host blocks are malformed, with the 1-based line it was found on.
 *
 * @public
 */
export interface HostBlockProblem {
	readonly line: number;
	readonly message: string;
}

/**
 * {@link applyHostBlocks}, also returning the 1-based source line of each
 * line of the result, so a problem found in the result can be reported where
 * the author wrote it.
 *
 * @internal
 */
export const mapHostBlocks = (
	text: string,
	target: string,
	known: ReadonlyArray<string>,
): { readonly text: string; readonly lines: ReadonlyArray<number> } | { readonly problem: HostBlockProblem } => {
	const lines = text.split("\n");
	if (!MARKER.test(text)) return { text, lines: lines.map((_, index) => index + 1) };
	const kept: Array<string> = [];
	const sources: Array<number> = [];
	const push = (line: string, number: number): void => {
		kept.push(line);
		sources.push(number);
	};
	let open: { readonly line: number; readonly keep: boolean } | undefined;
	let fence: string | undefined;
	for (const [index, line] of lines.entries()) {
		const number = index + 1;
		const keep = open === undefined || open.keep;
		const fenceMark = FENCE.exec(line)?.[1];
		if (fence !== undefined || fenceMark !== undefined) {
			// A fence closes on the same character, at least as long.
			if (fence === undefined) fence = fenceMark;
			else if (fenceMark !== undefined && fenceMark[0] === fence[0] && fenceMark.length >= fence.length) {
				fence = undefined;
			}
			if (keep) push(line, number);
			continue;
		}
		const opening = OPEN.exec(line);
		if (opening !== null) {
			if (open !== undefined) return { problem: { line: number, message: "host blocks do not nest" } };
			const ids = (opening[1] ?? "").split(/\s+/).filter((id) => id.length > 0);
			const unknown = ids.filter((id) => !known.includes(id));
			if (ids.length === 0) return { problem: { line: number, message: "a host block names no target" } };
			if (unknown.length > 0) {
				return {
					problem: {
						line: number,
						message: `unknown target ${unknown.map((id) => `"${id}"`).join(", ")} in a host block`,
					},
				};
			}
			open = { line: number, keep: ids.includes(target) };
			continue;
		}
		if (CLOSE.test(line)) {
			if (open === undefined) return { problem: { line: number, message: "a host block closes without opening" } };
			open = undefined;
			continue;
		}
		if (MARKER.test(stripInlineCode(line))) {
			return { problem: { line: number, message: "a host block marker must be on a line of its own" } };
		}
		if (keep) push(line, number);
	}
	if (open !== undefined) return { problem: { line: open.line, message: "a host block is never closed" } };
	return { text: kept.join("\n"), lines: sources };
};

/**
 * Keep the passages of a body's host blocks that list `target`, drop the
 * rest, and remove every marker line. Blocks do not nest; an unclosed block,
 * a stray close, a marker that is not on a line of its own, or an id outside
 * `known` is a problem, and the body is not rewritten. Tokens and
 * `pluginfinity://` links are left for {@link renderTokens}, which runs after.
 *
 * @public
 */
export const applyHostBlocks = (
	text: string,
	target: string,
	known: ReadonlyArray<string>,
): { readonly text: string } | { readonly problem: HostBlockProblem } => {
	const mapped = mapHostBlocks(text, target, known);
	return "problem" in mapped ? mapped : { text: mapped.text };
};

/**
 * For each line of `text`, whether it belongs to fenced code: a fence's
 * opening and closing lines and everything between. A fence closes on the
 * same character, at least as long; an unclosed fence runs to the end.
 *
 * @internal
 */
export const fencedLines = (lines: ReadonlyArray<string>): ReadonlyArray<boolean> => {
	let fence: string | undefined;
	return lines.map((line) => {
		const fenceMark = FENCE.exec(line)?.[1];
		if (fence === undefined && fenceMark === undefined) return false;
		if (fence === undefined) fence = fenceMark;
		else if (fenceMark !== undefined && fenceMark[0] === fence[0] && fenceMark.length >= fence.length) {
			fence = undefined;
		}
		return true;
	});
};
