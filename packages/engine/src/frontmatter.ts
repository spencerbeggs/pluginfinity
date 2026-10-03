import type { FieldMapEntry, Target } from "@pluginfinity/core";

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

/** A tool list as names: an array as is, a string split on commas and whitespace. */
const toolNames = (value: unknown): ReadonlyArray<string> =>
	Array.isArray(value)
		? value.map(String)
		: String(value)
				.split(/[\s,]+/)
				.filter((name) => name.length > 0);

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
 * The result of mapping a component's frontmatter onto a target: the fields
 * to write in order, the sections to append to the body, and any fields the
 * target cannot place.
 *
 * @public
 */
export interface MappedFrontmatter {
	readonly fields: Readonly<Record<string, unknown>>;
	readonly sections: ReadonlyArray<{ readonly field: string; readonly value: unknown }>;
	readonly unresolved: ReadonlyArray<UnresolvedField>;
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
 * no field is degraded into it: the author wrote that host's description.
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
				break;
			case "translate": {
				const names: Array<string> = [];
				for (const name of toolNames(value)) {
					const mapped = target.tools.names[name];
					if (mapped === undefined) names.push(name);
					else if (typeof mapped === "string") names.push(mapped);
					else unresolved.push({ field: `${field}: ${name}`, note: mapped.note });
				}
				fields[field] = names;
				break;
			}
			case "degrade":
				if (entry.form === "description-suffix") {
					if (!("description" in block)) suffixes.push(`${SUFFIX_LABELS[field] ?? field}: ${asText(value)}`);
				} else {
					sections.push({ field, value });
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
	return { fields, sections, unresolved, unknown };
};

/** The heading a field degraded to a body section is written under, by field. */
const SECTION_TITLES: Readonly<Record<string, string>> = { skills: "Skills" };

/**
 * Append each degraded field to `body` as a section: a level-two heading and
 * the value as a bullet list.
 *
 * @public
 */
export const appendSections = (
	body: string,
	sections: ReadonlyArray<{ readonly field: string; readonly value: unknown }>,
): string =>
	sections.reduce((text, { field, value }) => {
		const items = (Array.isArray(value) ? value : [value]).map((item) => `- ${String(item)}`).join("\n");
		return `${text.trimEnd()}\n\n## ${SECTION_TITLES[field] ?? field}\n\n${items}\n`;
	}, body);
