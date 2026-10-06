import type { FieldMapEntry, Target } from "@pluginfinity/core";
import type { BuildNoteKind } from "./notes.js";

/**
 * A markdown file split at its YAML frontmatter: the frontmatter text without
 * its fences, and the body after the closing fence, unchanged.
 *
 * @public
 */
export interface SplitMarkdown {
	readonly frontmatter: string;
	readonly body: string;
}

/**
 * Split `text` at a frontmatter block that opens on the first line with `---`
 * and closes at the next line holding only `---`; `undefined` when there is
 * none.
 *
 * @public
 */
export const splitFrontmatter = (text: string): SplitMarkdown | undefined => {
	const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
	return match === null ? undefined : { frontmatter: match[1] ?? "", body: text.slice(match[0].length) };
};

/**
 * How a degraded field is phrased when it moves into `description`, by field.
 * A field with no entry uses its own name as the label.
 */
const SUFFIX_LABELS: Readonly<Record<string, string>> = {
	when_to_use: "Also use when",
	paths: "Applies to files matching",
};

const asText = (value: unknown): string => (Array.isArray(value) ? value.map(String).join(", ") : String(value));

/**
 * A tool list as entries: an array as is, a string split on commas and
 * whitespace outside parentheses, so a rule such as `Bash(git log:*)` stays
 * one entry.
 */
const toolNames = (value: unknown): ReadonlyArray<string> => {
	if (Array.isArray(value)) return value.map(String);
	const names: Array<string> = [];
	let current = "";
	let depth = 0;
	for (const char of String(value)) {
		if (char === "(") depth += 1;
		if (char === ")") depth = Math.max(0, depth - 1);
		if (depth === 0 && /[\s,]/.test(char)) {
			if (current.length > 0) names.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	if (current.length > 0) names.push(current);
	return names;
};

/**
 * A Claude Code MCP tool name, `mcp__<server>__<tool>`, in the target's MCP
 * spelling, or `undefined` when it is not one the target can spell: any other
 * name, or a server named `plugin_…`, which belongs to another plugin whose
 * server name on the target is unknown.
 */
const mcpToolName = (target: Target, name: string): string | undefined => {
	const match = /^mcp__(.+?)__(.+)$/.exec(name);
	if (match === null || (match[1] ?? "").startsWith("plugin_")) return undefined;
	return target.tools.mcp.replace("{server}", match[1] ?? "").replace("{tool}", match[2] ?? "");
};

/**
 * A field the target's field map leaves open, set on a component: the build
 * cannot decide what to write.
 *
 * @public
 */
export interface UnresolvedField {
	readonly field: string;
	readonly note: string;
}

/**
 * Something a target did not carry as written while mapping a component: a
 * field it dropped or degraded, or a tool it could not name, in which case
 * `field` is the tool's name.
 *
 * @public
 */
export interface FieldDrop {
	readonly field: string;
	readonly kind: Exclude<BuildNoteKind, "hook-omitted">;
}

/**
 * The result of mapping a component's frontmatter onto a target: the fields
 * to write in order, the sections to append to the body, any fields the
 * target cannot place, and what it dropped or degraded.
 *
 * @public
 */
export interface MappedFrontmatter {
	readonly fields: Readonly<Record<string, unknown>>;
	readonly sections: ReadonlyArray<{ readonly field: string; readonly value: unknown }>;
	readonly unresolved: ReadonlyArray<UnresolvedField>;
	/** Each field dropped or degraded and each tool dropped, once, in the order met. */
	readonly drops: ReadonlyArray<FieldDrop>;
	/** Fields in the target block that are neither core fields nor the target's host fields. */
	readonly unknown: ReadonlyArray<string>;
}

/**
 * Map one component's frontmatter onto a target through the target's field
 * map.
 *
 * @remarks
 * The component's `targets` block for this target overlays the base fields:
 * a core field there replaces the base value before mapping, and a host field
 * (one of `hostFields`) is written as is. When the block sets `description`,
 * no field is degraded into it: the author wrote that host's description,
 * so no such field is reported in `drops`.
 *
 * @public
 */
export const mapFrontmatter = (
	target: Target,
	map: Readonly<Record<string, FieldMapEntry>>,
	hostFields: ReadonlyArray<string>,
	base: Readonly<Record<string, unknown>>,
	block: Readonly<Record<string, unknown>>,
): MappedFrontmatter => {
	const coreOverlay = Object.fromEntries(Object.entries(block).filter(([key]) => key in map));
	const hostOverlay = Object.entries(block).filter(([key]) => hostFields.includes(key));
	const unknown = Object.keys(block).filter((key) => !(key in map) && !hostFields.includes(key));
	const source: Record<string, unknown> = { ...base, ...coreOverlay };
	delete source.targets;

	const fields: Record<string, unknown> = {};
	const suffixes: Array<string> = [];
	const sections: Array<{ field: string; value: unknown }> = [];
	const unresolved: Array<UnresolvedField> = [];
	const drops: Array<FieldDrop> = [];
	const dropped = (field: string, kind: FieldDrop["kind"]): void => {
		if (!drops.some((drop) => drop.field === field && drop.kind === kind)) drops.push({ field, kind });
	};
	for (const [field, value] of Object.entries(source)) {
		if (value === undefined) continue;
		const entry = map[field];
		if (entry === undefined) continue;
		switch (entry._tag) {
			case "keep":
				fields[field] = value;
				break;
			case "rename":
				fields[entry.to] = value;
				break;
			case "drop":
				dropped(field, "dropped");
				break;
			case "translate": {
				const name = entry.to ?? field;
				if (entry.table !== "tools") {
					const mapped = target[entry.table][String(value)];
					if (mapped === undefined) fields[name] = value;
					else if (typeof mapped === "string") fields[name] = mapped;
					else if (mapped._tag === "unresolved") {
						unresolved.push({ field: `${field}: ${String(value)}`, note: mapped.note });
					}
					// A value the table drops (model: inherit) is the host's default, so nothing is lost: no note.
					break;
				}
				const names: Array<string> = [];
				for (const name of toolNames(value)) {
					// A rule such as Bash(git log:*) narrows a tool. A target that renames
					// the tool has no way to carry the rule, and dropping the rule would
					// widen what the tool may do, so the author must decide.
					const rule = /^([^(]+)\(.*\)$/.exec(name);
					if (rule !== null && target.tools.names[rule[1] ?? ""] !== undefined) {
						unresolved.push({
							field: `${field}: ${name}`,
							note: `${rule[1]} is renamed on this host, which has no per-command tool rules; set ${field} in this host's targets block`,
						});
						continue;
					}
					const mapped =
						target.tools.names[name] ??
						mcpToolName(target, name) ??
						(target.tools.unlisted === "keep" ? name : undefined);
					if (typeof mapped === "string") {
						if (!names.includes(mapped)) names.push(mapped);
					} else if (mapped?._tag === "unresolved") {
						unresolved.push({ field: `${field}: ${name}`, note: mapped.note });
					} else {
						// No spelling on the target, or a table entry that drops the tool.
						dropped(name, "tool-dropped");
					}
				}
				fields[name] = names;
				break;
			}
			case "degrade":
				if (entry.form === "description-suffix") {
					if (!("description" in block)) {
						suffixes.push(`${SUFFIX_LABELS[field] ?? field}: ${asText(value)}`);
						dropped(field, "degraded");
					}
				} else {
					sections.push({ field, value });
					dropped(field, "degraded");
				}
				break;
			case "unresolved":
				unresolved.push({ field, note: entry.note });
				break;
		}
	}
	if (suffixes.length > 0 && typeof fields.description === "string") {
		fields.description = [fields.description.trimEnd(), ...suffixes].join(" ");
	}
	for (const [key, value] of hostOverlay) fields[key] = value;
	return { fields, sections, unresolved, drops, unknown };
};

/** The heading a field degraded to a body section is written under, by field. */
const SECTION_TITLES: Readonly<Record<string, string>> = { skills: "Skills" };

/**
 * Append each degraded field to `body` as a section: a level-two heading and
 * the value as a bullet list, marked like the body's first bullet list (`-`
 * when it has none), so a linter that wants one marker per document passes.
 *
 * @public
 */
export const appendSections = (
	body: string,
	sections: ReadonlyArray<{ readonly field: string; readonly value: unknown }>,
): string => {
	const marker = /^[-+*](?= )/m.exec(body)?.[0] ?? "-";
	return sections.reduce((text, { field, value }) => {
		const items = (Array.isArray(value) ? value : [value]).map((item) => `${marker} ${String(item)}`).join("\n");
		return `${text.trimEnd()}\n\n## ${SECTION_TITLES[field] ?? field}\n\n${items}\n`;
	}, body);
};
