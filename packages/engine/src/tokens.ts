import type { Target, Unresolved } from "@pluginfinity/core";
import { INLINE_CODE, fencedLines } from "./body.js";
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
	/** The plugin's Claude name: the `claude.name` override, else `name`. */
	readonly plugin: string;
	/** The plugin's skill names. */
	readonly skills: ReadonlySet<string>;
	/** The plugin's agent names. */
	readonly agents: ReadonlySet<string>;
	/** Every file under a skill directory, as `<skill>/<path>`, `SKILL.md` included. */
	readonly skillFiles: ReadonlySet<string>;
	/** The plugin's own MCP servers on this target, if it declares any. */
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

const KINDS = new Set(["tool", "agent", "skill", "plugin_root"]);
/** The first word after `{{`: up to whitespace or a brace. */
const KIND = /^\s*([^\s{}]+)/;
const LINK = /(!?)\[([^[\]]*)\]\(\s*<?pluginfinity:\/\/([^\s<>()]*)>?\s*\)/g;
const REFERENCE = /\]\(\s*<?pluginfinity:\/\//g;

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
	if (split !== undefined) return { value: fill(runtime.mcp, { plugin: ctx.plugin, ...split }) };
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
	const [kind = "", ...args] = inner
		.trim()
		.split(/\s+/)
		.filter((part) => part.length > 0);
	if (kind === "plugin_root") {
		if (args.length > 0) return { problem: `${raw}: plugin_root takes no argument` };
		return spelling(ctx.target.pluginRoot.body, raw);
	}
	const [name] = args;
	if (name === undefined) return { problem: `${raw} needs a ${kind} name` };
	if (args.length > 1) return { problem: `${raw} takes one ${kind} name` };
	if (kind === "tool") return tool(name, raw, ctx);
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
		if (open - 1 >= at && line[open - 1] === "\\") {
			out += `${line.slice(at, open - 1)}{{`;
			at = open + 2;
			continue;
		}
		const kind = KIND.exec(line.slice(open + 2))?.[1];
		if (kind === undefined || !KINDS.has(kind)) {
			// Not a token: keep one brace and look again from the next, so the
			// token in `{{{tool Read}}}` starts at the pair right before its kind.
			out += line.slice(at, open + 1);
			at = open + 1;
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
	const [kind = "", name = "", ...rest] = destination.split("/");
	const path = rest.join("/").replace(/\/+$/, "");
	if (kind === "agent") {
		if (name === "" || path !== "") return { problem: `${raw}: an agent link is pluginfinity://agent/<agent>` };
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
	return { value: `[${text}](${root.value}/skills/${name}/${path === "" ? "SKILL.md" : path})` };
};

/** Rewrite the `pluginfinity://` links on one line outside fenced code, skipping inline code spans. */
const links = (line: string, ctx: TokenContext, problems: Array<string>): string => {
	if (!line.includes("pluginfinity://")) return line;
	const code = [...line.matchAll(INLINE_CODE)].map((m) => [m.index, m.index + m[0].length] as const);
	const inCode = (at: number): boolean => code.some(([start, end]) => at >= start && at < end);
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
	for (const match of line.matchAll(REFERENCE)) {
		const at = match.index;
		if (inCode(at) || handled.some(([start, end]) => at >= start && at < end)) continue;
		problems.push(
			"a pluginfinity:// link must be [text](pluginfinity://skill/<skill>[/<path>]) or [text](pluginfinity://agent/<agent>), with no title",
		);
	}
	return out;
};

/**
 * Render a markdown body's tokens and `pluginfinity://` links for one target,
 * or report every one it cannot render.
 *
 * @remarks
 * A token is `{{tool <name>}}`, `{{agent <name>}}`, `{{skill <name>}}` or
 * `{{plugin_root}}`, with whitespace allowed inside the braces, on one line.
 * Tokens are replaced everywhere, fenced and inline code included; `\{{`
 * renders a literal `{{`. A `{{` whose first word is not a kind is text, so
 * GitHub Actions expressions, Jinja and Handlebars pass through;
 * a token starts at the `{{` right before its kind, so `{{{tool Read}}}`
 * keeps the outer braces. A known kind that cannot be spelled is a problem:
 * a missing or extra argument, a token never closed on its line, or a brace
 * inside one.
 *
 * A markdown link to `pluginfinity://skill/<skill>[/<path>]` or
 * `pluginfinity://agent/<agent>` outside fenced and inline code is built in
 * the target's reference style; inside code it stays text. A link the
 * renderer cannot parse is a problem rather than shipped.
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
	if (!text.includes("{{") && !text.includes("pluginfinity://")) return { text };
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
