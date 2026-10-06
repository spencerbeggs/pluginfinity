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
export const INLINE_CODE = /(`+)[\s\S]*?\1/g;

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
 * Keep the passages of a body's host blocks that list `target`, drop the
 * rest, and remove every marker line. Blocks do not nest; an unclosed block,
 * a stray close, a marker that is not on a line of its own, or an id outside
 * `known` is a problem, and the body is not rewritten. So, until references
 * are built, is a `pluginfinity://` link; see {@link referenceLines}.
 *
 * @public
 */
export const applyHostBlocks = (
	text: string,
	target: string,
	known: ReadonlyArray<string>,
): { readonly text: string } | { readonly problem: HostBlockProblem } => {
	const [reference] = referenceLines(text);
	if (reference !== undefined) {
		return {
			problem: {
				line: reference,
				message: "pluginfinity:// references are not built yet; link with a relative path instead",
			},
		};
	}
	if (!MARKER.test(text)) return { text };
	const kept: Array<string> = [];
	let open: { readonly line: number; readonly keep: boolean } | undefined;
	let fence: string | undefined;
	const lines = text.split("\n");
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
			if (keep) kept.push(line);
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
		if (MARKER.test(line.replace(INLINE_CODE, ""))) {
			return { problem: { line: number, message: "a host block marker must be on a line of its own" } };
		}
		if (keep) kept.push(line);
	}
	if (open !== undefined) return { problem: { line: open.line, message: "a host block is never closed" } };
	return { text: kept.join("\n") };
};

const REFERENCE = /\]\(\s*<?pluginfinity:\/\//;

/**
 * The 1-based lines of a body that link to a `pluginfinity://` reference,
 * outside fenced code and inline code spans. References are not built yet,
 * and an unbuilt reference must never ship as text, so each is a problem.
 *
 * @public
 */
export const referenceLines = (text: string): ReadonlyArray<number> => {
	if (!text.includes("pluginfinity://")) return [];
	const found: Array<number> = [];
	let fence: string | undefined;
	for (const [index, line] of text.split("\n").entries()) {
		const fenceMark = FENCE.exec(line)?.[1];
		if (fence !== undefined || fenceMark !== undefined) {
			if (fence === undefined) fence = fenceMark;
			else if (fenceMark !== undefined && fenceMark[0] === fence[0] && fenceMark.length >= fence.length) {
				fence = undefined;
			}
			continue;
		}
		if (REFERENCE.test(line.replace(INLINE_CODE, ""))) found.push(index + 1);
	}
	return found;
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
