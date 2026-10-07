import type { Target, Unresolved } from "@pluginfinity/core";
import { fencedLines, inlineCodeSpans } from "./body.js";
import type { OwnMcp } from "./frontmatter.js";
import { splitOwnMcp } from "./frontmatter.js";

/**
 * What {@link renderTokens} needs to spell a plugin's tokens and links for
 * one target.
 *
 * @public
 */
export interface TokenContext {
	/** The target being built. */
	readonly target: Target;
	/**
	 * The plugin's name on this target: its `<target>.name` override, else
	 * `name`. Agent ids and skill commands are spelled with it.
	 */
	readonly plugin: string;
	/** The plugin's skill names. */
	readonly skills: ReadonlySet<string>;
	/**
	 * The skill whose body (or bundled markdown file) is being rendered, so
	 * `{{skill_dir}}` can name it; absent when rendering an agent body.
	 */
	readonly skill?: string;
	/** The plugin's agent names. */
	readonly agents: ReadonlySet<string>;
	/** Every file under a skill directory, as `<skill>/<path>`, `SKILL.md` included. */
	readonly skillFiles: ReadonlySet<string>;
	/**
	 * The plugin's own MCP servers on this target, if it declares any.
	 * `own.plugin` is the plugin's Claude name, which Claude Code namespaces
	 * MCP tools with: a body names an own tool by that name on every target,
	 * and the run-time MCP template's `{plugin}` is filled from it, so it can
	 * differ from `plugin` when the target renames the plugin.
	 */
	readonly own: OwnMcp | undefined;
}

/**
 * A token or link {@link renderTokens} could not spell, with its 1-based line.
 *
 * @public
 */
export interface TokenProblem {
	readonly line: number;
	readonly message: string;
}

const KINDS = new Set(["tool", "agent", "skill", "skill_dir", "plugin_root"]);
/** The first word after `{{`: up to whitespace, a brace, a pipe or a backtick. */
const KIND = /^\s*([^\s{}`|]+)/;
const LINK = /(!?)\[([^[\]]*)\]\(\s*<?pluginfinity:\/\/([^\s<>()]*)>?\s*\)/g;
/** Every `pluginfinity://` occurrence, in any case. */
const SCHEMES = /pluginfinity:\/\//gi;
const SCHEME = /pluginfinity:\/\//i;
/** How far a quoted stray occurrence reaches either side of its start, so each problem is cheap to build. */
const WINDOW = 80;
/** How many stray occurrences on one line are reported individually. */
const STRAY_LIMIT = 3;
const isSpace = (char: string | undefined): boolean => char === undefined || /\s/.test(char);
/** The run of non-whitespace around position `at`, clipped to a window, to quote a stray occurrence. */
const around = (line: string, at: number): string => {
	const floor = Math.max(0, at - WINDOW);
	let start = at;
	while (start > floor && !isSpace(line[start - 1])) start -= 1;
	const ceiling = Math.min(line.length, at + WINDOW);
	let end = at;
	while (end < ceiling && !isSpace(line[end])) end += 1;
	const clippedStart = start === floor && start > 0 && !isSpace(line[start - 1]);
	const clippedEnd = end === ceiling && end < line.length && !isSpace(line[end]);
	return `${clippedStart ? "…" : ""}${line.slice(start, end)}${clippedEnd ? "…" : ""}`;
};

const article = (word: string): string => (/^[aeiou]/.test(word) ? `an ${word}` : `a ${word}`);

type Spelled = { readonly value: string } | { readonly problem: string };

const fill = (template: string, values: Readonly<Record<string, string>>): string =>
	template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

const spelling = (value: string | Unresolved, what: string): Spelled =>
	typeof value === "string" ? { value } : { problem: `${what} has no spelling on this target: ${value.note}` };

const tool = (name: string, raw: string, ctx: TokenContext): Spelled => {
	const runtime = ctx.target.tools.runtime;
	const listed = Object.hasOwn(runtime.names, name) ? runtime.names[name] : undefined;
	if (listed !== undefined) return spelling(listed, raw);
	const split = ctx.own === undefined ? undefined : splitOwnMcp(name, ctx.own);
	if (split !== undefined && ctx.own !== undefined) {
		return { value: fill(runtime.mcp, { plugin: ctx.own.plugin, ...split }) };
	}
	if (runtime.unlisted === "keep") return { value: name };
	return {
		problem: name.startsWith("mcp__")
			? `${raw} has no run-time name on this target: only this plugin's own declared MCP servers can be spelled`
			: `${raw} has no run-time name on this target`,
	};
};

/** Spell the inside of one `{{…}}` that opens with a known kind; `raw` is the whole token as written. */
const token = (inner: string, raw: string, ctx: TokenContext): Spelled => {
	if (/[{}]/.test(inner)) return { problem: `malformed token ${raw}; write \\{{ for a literal {{` };
	const bar = inner.indexOf("|");
	const head = bar === -1 ? inner : inner.slice(0, bar);
	const fallback = bar === -1 ? undefined : inner.slice(bar + 1).trim();
	const [kind = "", ...args] = head
		.trim()
		.split(/\s+/)
		.filter((part) => part.length > 0);
	// The name of a tool token may be wrapped in exactly one pair of backticks, to render as a code span.
	let code = false;
	if (head.includes("`")) {
		if (kind !== "tool") return { problem: `${raw}: only a tool token takes a backtick-wrapped name` };
		const wrapped = /^\s*tool\s+`([^`\s]+)`\s*$/.exec(head);
		if (wrapped === null) {
			return { problem: `${raw}: wrap the tool name in exactly one pair of backticks, as {{tool \`Name\`}}` };
		}
		code = true;
		args[0] = wrapped[1] as string;
		args.length = 1;
	}
	if (fallback !== undefined && kind !== "tool") return { problem: `${raw}: only a tool token takes a | fallback` };
	if (kind === "plugin_root") {
		if (args.length > 0) return { problem: `${raw}: plugin_root takes no argument` };
		return spelling(ctx.target.pluginRoot.body, raw);
	}
	const [name] = args;
	if (kind === "skill_dir") {
		if (args.length > 1) return { problem: `${raw} takes one skill_dir name` };
		if (name === undefined && ctx.skill === undefined) {
			return { problem: `${raw}: an agent has no skill directory; name a skill, {{skill_dir <skill>}}` };
		}
		const skill = name ?? (ctx.skill as string);
		if (!ctx.skills.has(skill)) return { problem: `${raw}: this plugin has no skill "${skill}"` };
		const spelling = skill === ctx.skill ? ctx.target.skills.dirSpelling.own : ctx.target.skills.dirSpelling.other;
		return { value: fill(spelling, { skill }) };
	}
	if (name === undefined) return { problem: `${raw} needs ${article(kind)} name` };
	if (args.length > 1) return { problem: `${raw} takes one ${kind} name` };
	if (kind === "tool") {
		if (fallback === "") return { problem: `${raw}: the fallback after | is empty` };
		const spelled = tool(name, raw, ctx);
		if (fallback !== undefined && "problem" in spelled) return { value: fallback };
		return code && "value" in spelled ? { value: `\`${spelled.value}\`` } : spelled;
	}
	if (kind === "agent") {
		if (!ctx.agents.has(name)) return { problem: `${raw}: this plugin has no agent "${name}"` };
		return { value: fill(ctx.target.agents.id, { plugin: ctx.plugin, agent: name }) };
	}
	if (!ctx.skills.has(name)) return { problem: `${raw}: this plugin has no skill "${name}"` };
	const invoke = spelling(ctx.target.skills.invoke, raw);
	return "value" in invoke ? { value: fill(invoke.value, { plugin: ctx.plugin, skill: name }) } : invoke;
};

/** Replace every token on one line, honouring the `\{{` escape. */
const tokens = (line: string, ctx: TokenContext, problems: Array<string>): string => {
	if (!line.includes("{{")) return line;
	let out = "";
	let at = 0;
	while (at < line.length) {
		const open = line.indexOf("{{", at);
		if (open === -1) {
			out += line.slice(at);
			break;
		}
		const kind = KIND.exec(line.slice(open + 2))?.[1];
		if (kind === undefined || !KINDS.has(kind)) {
			// Not a token, so a backslash before it stays too. Keep one brace and
			// look again from the next, so the token in `{{{tool Read}}}` starts
			// at the pair right before its kind.
			out += line.slice(at, open + 1);
			at = open + 1;
			continue;
		}
		if (open - 1 >= at && line[open - 1] === "\\") {
			out += `${line.slice(at, open - 1)}{{`;
			at = open + 2;
			continue;
		}
		out += line.slice(at, open);
		const close = line.indexOf("}}", open + 2);
		if (close === -1) {
			problems.push(`a {{${kind} token is never closed on its line; write \\{{ for a literal {{`);
			out += line.slice(open);
			break;
		}
		const raw = line.slice(open, close + 2);
		const spelled = token(line.slice(open + 2, close), raw, ctx);
		if ("value" in spelled) out += spelled.value;
		else {
			problems.push(spelled.problem);
			out += raw;
		}
		at = close + 2;
	}
	return out;
};

const link = (text: string, destination: string, raw: string, ctx: TokenContext): Spelled => {
	const hash = destination.indexOf("#");
	const target = hash === -1 ? destination : destination.slice(0, hash);
	const anchor = hash === -1 ? "" : destination.slice(hash);
	const [kind = "", name = "", ...rest] = target.split("/");
	const path = rest.join("/").replace(/\/+$/, "");
	if (kind === "agent") {
		if (name === "" || path !== "" || anchor !== "") {
			return { problem: `${raw}: an agent link is pluginfinity://agent/<agent>, with no path or anchor` };
		}
		if (!ctx.agents.has(name)) return { problem: `${raw}: this plugin has no agent "${name}"` };
		return { value: `${text} (\`${fill(ctx.target.agents.id, { plugin: ctx.plugin, agent: name })}\`)` };
	}
	if (kind !== "skill") {
		return { problem: `${raw}: a link is pluginfinity://skill/<skill>[/<path>] or pluginfinity://agent/<agent>` };
	}
	if (name === "") return { problem: `${raw}: a skill link names a skill, pluginfinity://skill/<skill>[/<path>]` };
	if (!ctx.skills.has(name)) return { problem: `${raw}: this plugin has no skill "${name}"` };
	if (path !== "" && !ctx.skillFiles.has(`${name}/${path}`)) {
		return { problem: `${raw}: skill "${name}" has no file "${path}" (looked for ${name}/${path})` };
	}
	if (ctx.target.references.style === "prose") {
		return { value: path === "" ? `${text} (the \`${name}\` skill)` : `${text} (the \`${name}\` skill's \`${path}\`)` };
	}
	const root = spelling(ctx.target.pluginRoot.body, raw);
	if (!("value" in root)) return root;
	const file = path === "" ? "SKILL.md" : path;
	return { value: `[${text}](${root.value}/${ctx.target.skills.dir}/${name}/${file}${anchor})` };
};

/**
 * Rewrite the inline `pluginfinity://` links on one line outside fenced code,
 * skipping inline code spans; any other `pluginfinity://` outside code, in any
 * case, is a problem, so nothing unbuilt ships.
 */
const links = (line: string, ctx: TokenContext, problems: Array<string>): string => {
	if (!SCHEME.test(line)) return line;
	const code = inlineCodeSpans(line);
	const inCode = (at: number): boolean => {
		let lo = 0;
		let hi = code.length - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			const span = code[mid] as { start: number; end: number };
			if (at < span.start) hi = mid - 1;
			else if (at >= span.end) lo = mid + 1;
			else return true;
		}
		return false;
	};
	const handled: Array<readonly [number, number]> = [];
	const out = line.replace(LINK, (raw, bang: string, text: string, destination: string, offset: number) => {
		if (inCode(offset + bang.length)) return raw;
		handled.push([offset, offset + raw.length]);
		if (bang !== "") {
			problems.push(`${raw}: an image cannot link to a pluginfinity:// reference`);
			return raw;
		}
		const spelled = link(text, destination, raw, ctx);
		if ("value" in spelled) return spelled.value;
		problems.push(spelled.problem);
		return raw;
	});
	// Every occurrence is checked on its own, so a stray one glued to a built
	// link (no whitespace between) is still caught.
	// Matches and handled ranges are both in line order, so one pointer walks
	// the ranges as the matches advance.
	let range = 0;
	let strays = 0;
	for (const match of line.matchAll(SCHEMES)) {
		const at = match.index;
		while (range < handled.length && (handled[range] as readonly [number, number])[1] <= at) range += 1;
		const current = handled[range];
		if (current !== undefined && current[0] <= at) continue;
		if (inCode(at)) continue;
		strays += 1;
		if (strays > STRAY_LIMIT) continue;
		problems.push(
			`${around(line, at)}: only inline links [text](pluginfinity://skill/<skill>[/<path>][#anchor]) and [text](pluginfinity://agent/<agent>) are built, with no title`,
		);
	}
	if (strays > STRAY_LIMIT) {
		problems.push(`and ${strays - STRAY_LIMIT} more pluginfinity:// occurrences on this line that are not built links`);
	}
	return out;
};

/**
 * Render a markdown body's tokens and `pluginfinity://` links for one target,
 * or report every one it cannot render.
 *
 * @remarks
 * A token is one of the following, with whitespace allowed inside the braces,
 * on one line:
 *
 * ```text
 * {{tool <name>}}
 * {{tool <name> | <fallback>}}
 * {{agent <name>}}
 * {{skill <name>}}
 * {{skill_dir}}
 * {{skill_dir <name>}}
 * {{plugin_root}}
 * ```
 *
 * `{{skill_dir}}` is the directory of the skill whose body it is written in,
 * and `{{skill_dir <name>}}` that of the named skill (naming the own skill is
 * the own form). Claude spells them `${CLAUDE_SKILL_DIR}` and
 * `${CLAUDE_PLUGIN_ROOT}/skills/<name>`, which it expands in skill bodies;
 * Copilot expands nothing, so it spells prose that points at the "Base
 * directory for this skill" line the host puts above the body. An agent has
 * no skill directory, so the bare form there, an unknown skill or one the
 * target does not build is a problem. It takes neither a `|` fallback nor
 * backticks: the spelling is a path on one host and a sentence on the other.
 *
 * A tool token may wrap its name in exactly one pair of backticks:
 *
 * ```text
 * {{tool `Name`}}
 * {{tool `Name` | <fallback>}}
 * ```
 *
 * It then renders as a code span of the spelling where the tool spells, and as
 * the fallback in plain text where it does not;
 * unbalanced or doubled backticks, and backticks on any other kind, are
 * problems. Only a tool token takes
 * a `|` fallback: literal prose, trimmed, that replaces the token on a target
 * where the tool has no spelling (and is discarded where it has one). It may
 * not be empty or contain `{` or `}`.
 * Tokens are replaced everywhere, fenced and inline code included; `\{{`
 * before a token renders it literally, and before any other `{{` the
 * backslash stays. A `{{` whose first word is not a kind is text, so
 * GitHub Actions expressions, Jinja and Handlebars pass through;
 * a token starts at the `{{` right before its kind, so `{{{tool Read}}}`
 * keeps the outer braces. A known kind that cannot be spelled is a problem:
 * a missing or extra argument, a token never closed on its line, or a brace
 * inside one.
 *
 * An inline markdown link to `pluginfinity://skill/<skill>[/<path>][#anchor]`
 * or `pluginfinity://agent/<agent>` outside fenced and inline code is built in
 * the target's reference style; inside code it stays text. A path style keeps
 * the anchor; a prose style drops it. Any other `pluginfinity://` outside
 * code, in any case (a title, an image, a reference definition, an autolink),
 * is a problem rather than shipped.
 *
 * Known limits: an indented (four-space) code block is not treated as code,
 * an inline code span across two lines is not recognised, and an escaped
 * `\[text](pluginfinity://…)` is still built and keeps its backslash.
 *
 * Run it after host blocks are applied, so a token in another target's block
 * is never evaluated. The result is a pure function of its inputs.
 *
 * @public
 */
export const renderTokens = (
	text: string,
	ctx: TokenContext,
): { readonly text: string } | { readonly problems: ReadonlyArray<TokenProblem> } => {
	if (!text.includes("{{") && !SCHEME.test(text)) return { text };
	const lines = text.split("\n");
	const fenced = fencedLines(lines);
	const problems: Array<TokenProblem> = [];
	const rendered = lines.map((line, index) => {
		const found: Array<string> = [];
		const linked = fenced[index] === true ? line : links(line, ctx, found);
		const out = tokens(linked, ctx, found);
		for (const message of found) problems.push({ line: index + 1, message });
		return out;
	});
	return problems.length > 0 ? { problems } : { text: rendered.join("\n") };
};
