import { Yaml } from "@effected/yaml";
import type { Schema as SchemaNs } from "effect";
import { Effect, Schema, SchemaIssue } from "effect";
import { ComponentInvalid, ConfigIssue } from "./errors.js";
import { splitFrontmatter } from "./frontmatter.js";

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

/**
 * One problem with a component, keyed by field or by `line N, column M`.
 *
 * @internal
 */
export const issue = (key: string, message: string): ConfigIssue => ConfigIssue.make({ key, message });

/**
 * A `ComponentInvalid` for `path`, optionally specific to one target.
 *
 * @internal
 */
export const invalid = (path: string, issues: ReadonlyArray<ConfigIssue>, target?: string): ComponentInvalid =>
	new ComponentInvalid({ path, issues: [...issues], ...(target === undefined ? {} : { target }) });

/**
 * Plain values holding ` #`, which YAML reads as the start of a
 * comment: Claude Code's own frontmatter reader keeps the rest of the line,
 * every YAML parser drops it, so the value would silently lose its tail. It
 * checks every depth, including a `targets` block and list items, and skips
 * block scalars, where `#` is literal. A deliberate trailing comment is
 * flagged too; frontmatter rarely wants one.
 */
const trailingComments = (frontmatter: string): ReadonlyArray<ConfigIssue> => {
	const issues: Array<ConfigIssue> = [];
	// The indent of the key that opened a block scalar (| or >); lines indented
	// past it are the scalar's text, where # is literal.
	let block: number | undefined;
	for (const [index, line] of frontmatter.split("\n").entries()) {
		const indent = /^[ \t]*/.exec(line)?.[0].length ?? 0;
		if (block !== undefined && (line.trim() === "" || indent > block)) continue;
		block = undefined;
		if (BLOCK_SCALAR.test(line)) {
			block = indent;
			continue;
		}
		const match = KEYED_PLAIN.exec(line) ?? ITEM_PLAIN.exec(line);
		if (match === null) continue;
		const subject = match[1] === undefined ? "a list item" : `the plain value of ${match[1]}`;
		issues.push(
			issue(
				`line ${index + 2}`,
				`${subject} holds " #", which YAML reads as a comment, dropping the rest of the line; quote or fold the value`,
			),
		);
	}
	return issues;
};

// A key or list item whose value is a block scalar indicator.
const BLOCK_SCALAR = /^[ \t]*(?:-[ \t]+)?(?:[A-Za-z_][\w-]*:[ \t]*)?[|>][-+0-9]*[ \t]*(?:#.*)?$/;
// `key: value #…`, at any depth, optionally as a list item; the value is plain
// (not quoted, a block scalar or a flow collection).
const KEYED_PLAIN = /^[ \t]*(?:-[ \t]+)?([A-Za-z_][\w-]*):[ \t]+[^"'|>\s#[{].*?[ \t]+#/;
// `- value #…`: a plain list item.
const ITEM_PLAIN = /^[ \t]*-[ \t]+(?=[^"'|>\s#[{])(?![A-Za-z_][\w-]*:[ \t]).*?[ \t]+#/;

/**
 * Split a component file's text at its frontmatter, parse the frontmatter as
 * YAML, and decode it strictly against `schema`; any failure is a
 * `ComponentInvalid` for `path`.
 *
 * @internal
 */
export const decodeComponent = <S extends SchemaNs.Codec<unknown, unknown>>(
	path: string,
	text: string,
	schema: S,
): Effect.Effect<
	{
		readonly frontmatter: S["Type"];
		readonly frontmatterText: string;
		readonly body: string;
		readonly bodyOffset: number;
	},
	ComponentInvalid
> =>
	Effect.gen(function* () {
		const lf = toLf(text);
		const split = splitFrontmatter(lf);
		if (split === undefined) {
			return yield* Effect.fail(invalid(path, [issue("", "the file must open with a --- frontmatter block")]));
		}
		const comments = trailingComments(split.frontmatter);
		if (comments.length > 0) return yield* Effect.fail(invalid(path, comments));
		const raw = yield* Yaml.parse(split.frontmatter).pipe(
			// Diagnostics count lines and characters from 0 within the frontmatter,
			// which starts on the file's second line.
			Effect.mapError((error) =>
				invalid(
					path,
					error.diagnostics.map((diagnostic) =>
						issue(
							`line ${diagnostic.line + 2}, column ${diagnostic.character + 1}`,
							`the frontmatter is not valid YAML: ${diagnostic.message}`,
						),
					),
				),
			),
		);
		const frontmatter = yield* Schema.decodeUnknownEffect(schema)(raw ?? {}, {
			errors: "all",
			onExcessProperty: "error",
		}).pipe(
			Effect.mapError((error) =>
				invalid(
					path,
					formatter(error.issue).issues.map((found) => issue((found.path ?? []).map(String).join("."), found.message)),
				),
			),
		);
		// Decoding yields the schema's key order; keep the author's instead, so a
		// field a target keeps is written where the author put it.
		const decoded = frontmatter as Record<string, unknown>;
		const ordered = Object.fromEntries(
			Object.keys(typeof raw === "object" && raw !== null ? raw : {})
				.filter((key) => key in decoded)
				.map((key) => [key, decoded[key]]),
		) as S["Type"];
		// The lines before the body, so a body line N is file line N + bodyOffset.
		const bodyOffset = lf.slice(0, lf.length - split.body.length).split("\n").length - 1;
		return { frontmatter: ordered, frontmatterText: split.frontmatter, body: split.body, bodyOffset };
	});

/**
 * The `targets` keys a component names that are not known target ids.
 *
 * @internal
 */
export const unknownTargets = (
	targets: Readonly<Record<string, unknown>> | undefined,
	known: ReadonlyArray<string>,
): ReadonlyArray<ConfigIssue> =>
	Object.keys(targets ?? {})
		.filter((id) => !known.includes(id))
		.map((id) => issue(`targets.${id}`, `unknown target; known targets: ${known.join(", ")}`));

/**
 * The YAML options every built frontmatter is written with: no folding,
 * indented sequences, double quotes where quoting is needed, and YAML 1.1
 * lookalikes quoted.
 *
 * @internal
 */
export const STRINGIFY = {
	lineWidth: 0,
	quoteStyle: "double",
	quoteCompat: "yaml-1.1",
	indentSequences: true,
	finalNewline: true,
} as const;

/**
 * The frontmatter text a built component is written with: the author's own
 * text when the fields come out exactly as they went in, so a target that
 * keeps everything keeps the author's formatting and comments too, and
 * otherwise the fields serialized with {@link STRINGIFY}.
 *
 * @internal
 */
export const frontmatterText = (
	fields: Readonly<Record<string, unknown>>,
	source: { readonly frontmatter: Readonly<Record<string, unknown>>; readonly frontmatterText: string },
): Effect.Effect<string> =>
	JSON.stringify(fields) === JSON.stringify(source.frontmatter)
		? Effect.succeed(`${source.frontmatterText}\n`)
		: Yaml.stringify(fields, STRINGIFY).pipe(Effect.orDie);

/**
 * Check the core fields a component's `targets.<id>` block sets, together with
 * the base fields they overlay, against the component schema, so an override
 * is held to the same rules as the base. Problems are keyed
 * `targets.<id>.<field>`.
 *
 * @internal
 */
export const overlayIssues = <S extends SchemaNs.Codec<unknown, unknown>>(
	schema: S,
	coreFields: ReadonlyArray<string>,
	frontmatter: Readonly<Record<string, unknown>>,
	block: Readonly<Record<string, unknown>>,
	id: string,
): Effect.Effect<ReadonlyArray<ConfigIssue>> => {
	const overlay = Object.fromEntries(Object.entries(block).filter(([key]) => coreFields.includes(key)));
	if (Object.keys(overlay).length === 0) return Effect.succeed([]);
	const { targets: _targets, ...base } = frontmatter;
	return Schema.decodeUnknownEffect(schema)({ ...base, ...overlay }, { errors: "all", onExcessProperty: "error" }).pipe(
		Effect.as([]),
		Effect.catchTag("SchemaError", (error) =>
			Effect.succeed(
				formatter(error.issue).issues.map((found) => {
					const path = (found.path ?? []).map(String);
					const key = path.join(".");
					return issue(path[0] !== undefined && path[0] in overlay ? `targets.${id}.${key}` : key, found.message);
				}),
			),
		),
	);
};

/**
 * Whether a file name is operating-system clutter that never ships, such as
 * a Finder or Explorer index, or an editor backup.
 *
 * @internal
 */
export const isJunk = (name: string): boolean => JUNK.has(name) || name.endsWith("~");

const JUNK = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

/**
 * Text with every CRLF line ending turned to LF, so a build's line endings do
 * not depend on the machine that wrote the source.
 *
 * @internal
 */
export const toLf = (text: string): string => text.replaceAll("\r\n", "\n");
