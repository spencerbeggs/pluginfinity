import type { Target } from "@pluginfinity/core";
import { ComponentName, SKILL_FIELDS, SkillFrontmatter } from "@pluginfinity/core";
import type { PlatformError } from "effect";
import { Effect, FileSystem, Path, Schema } from "effect";
import { applyHostBlocks } from "./body.js";
import {
	decodeComponent,
	frontmatterText,
	invalid,
	isJunk,
	issue,
	overlayIssues,
	toLf,
	unknownTargets,
} from "./component.js";
import type { EmittedFile } from "./emit.js";
import type { ComponentInvalid, ConfigIssue } from "./errors.js";
import { appendSections, mapFrontmatter } from "./frontmatter.js";

/**
 * The most characters a built skill's `description` may hold: the Agent
 * Skills spec's limit, which Copilot enforces.
 *
 * @public
 */
export const SKILL_DESCRIPTION_MAX = 1024;

/**
 * One skill as read from `skills/<name>/`: its name, its decoded frontmatter,
 * its body, and its other files.
 *
 * @public
 */
export interface SourceSkill {
	/** The directory name, which is the skill's name. */
	readonly name: string;
	/** The absolute path of its `SKILL.md`. */
	readonly path: string;
	readonly frontmatter: typeof SkillFrontmatter.Type;
	/** The frontmatter as written, without its fences. */
	readonly frontmatterText: string;
	/** Everything after the closing frontmatter fence, unchanged. */
	readonly body: string;
	/** The file lines before the body. */
	readonly bodyOffset: number;
	/** Its other files, as `/`-separated paths relative to the skill directory, sorted. */
	readonly files: ReadonlyArray<string>;
}

/** Every file under `dir`, as sorted `/`-separated relative paths. */
const filesUnder = (
	dir: string,
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const files: Array<string> = [];
		for (const entry of yield* fs.readDirectory(dir, { recursive: true })) {
			if (isJunk(path.basename(entry))) continue;
			if ((yield* fs.stat(path.join(dir, entry))).type === "File") files.push(entry.split(path.sep).join("/"));
		}
		return files.sort();
	});

/** Read and decode one skill directory. */
const readSkill = (
	dir: string,
	name: string,
	known: ReadonlyArray<string>,
): Effect.Effect<SourceSkill, ComponentInvalid | PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const file = path.join(dir, "SKILL.md");
		if (!Schema.is(ComponentName)(name)) {
			return yield* Effect.fail(
				invalid(dir, [issue("", "the directory name must be 1 to 64 characters of a-z, 0-9 and single hyphens")]),
			);
		}
		if (!(yield* fs.exists(file))) return yield* Effect.fail(invalid(dir, [issue("", "the skill has no SKILL.md")]));
		const {
			frontmatter,
			frontmatterText: text,
			body,
			bodyOffset,
		} = yield* decodeComponent(file, yield* fs.readFileString(file), SkillFrontmatter);
		const problems: Array<ConfigIssue> = [
			...(frontmatter.name !== undefined && frontmatter.name !== name
				? [issue("name", `must equal the directory name "${name}"`)]
				: []),
			...unknownTargets(frontmatter.targets, known),
		];
		if (problems.length > 0) return yield* Effect.fail(invalid(file, problems));
		const files = (yield* filesUnder(dir)).filter((entry) => entry !== "SKILL.md");
		return { name, path: file, frontmatter, frontmatterText: text, body, bodyOffset, files };
	});

/**
 * Read every skill under `<root>/skills/`, sorted by name; none when the
 * directory is absent. A skill that does not decode is collected in
 * `failures` rather than stopping the read, so one build reports them all.
 *
 * @public
 */
export const readSkills = (
	root: string,
	known: ReadonlyArray<string>,
): Effect.Effect<
	{ readonly skills: ReadonlyArray<SourceSkill>; readonly failures: ReadonlyArray<ComponentInvalid> },
	PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const dir = path.join(root, "skills");
		if (!(yield* fs.exists(dir))) return { skills: [], failures: [] };
		const skills: Array<SourceSkill> = [];
		const failures: Array<ComponentInvalid> = [];
		for (const entry of (yield* fs.readDirectory(dir)).sort()) {
			const skillDir = path.join(dir, entry);
			if ((yield* fs.stat(skillDir)).type !== "Directory") continue;
			const skill = yield* readSkill(skillDir, entry, known).pipe(
				Effect.catchTag("ComponentInvalid", (error) => Effect.sync(() => void failures.push(error))),
			);
			if (skill !== undefined) skills.push(skill);
		}
		return { skills, failures };
	});

/**
 * Render one skill for a target, or `undefined` when its `targets` block
 * excludes it: `SKILL.md` with the target's frontmatter and host blocks
 * applied, `.md` support files with host blocks applied, and every other
 * file copied. Every file keeps its source mode.
 *
 * @public
 */
export const renderSkill = (
	target: Target,
	id: string,
	skill: SourceSkill,
	known: ReadonlyArray<string>,
): Effect.Effect<
	ReadonlyArray<EmittedFile> | undefined,
	ComponentInvalid | PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const block = skill.frontmatter.targets?.[id];
		if (block === false) return undefined;

		const mapped = mapFrontmatter(
			target,
			target.skills.fields,
			target.skills.hostFields,
			skill.frontmatter,
			block ?? {},
		);
		const problems: Array<ConfigIssue> = [
			...(yield* overlayIssues(SkillFrontmatter, SKILL_FIELDS, skill.frontmatter, block ?? {}, id)),
			...mapped.unresolved.map((field) => issue(field.field, `${id} leaves this field unresolved (${field.note})`)),
			...mapped.unknown.map((key) => issue(`targets.${id}.${key}`, `not a skill field or a ${id} skill field`)),
		];
		const { name: _name, description, ...rest } = mapped.fields;
		if (typeof description === "string" && description.length > SKILL_DESCRIPTION_MAX) {
			problems.push(
				issue(
					"description",
					`is ${description.length} characters on ${id}, over the ${SKILL_DESCRIPTION_MAX} limit; set a shorter targets.${id}.description`,
				),
			);
		}
		// A malformed host block is wrong for every target, so it names none.
		const body = applyHostBlocks(skill.body, id, known);
		if ("problem" in body) {
			return yield* Effect.fail(
				invalid(skill.path, [issue(`line ${body.problem.line + skill.bodyOffset}`, body.problem.message)]),
			);
		}
		if (problems.length > 0) return yield* Effect.fail(invalid(skill.path, problems, id));

		const yaml = yield* frontmatterText({ name: skill.name, description, ...rest }, skill);
		const dir = path.dirname(skill.path);
		const out = `${target.skills.dir}/${skill.name}`;
		const files: Array<EmittedFile> = [
			{
				path: `${out}/SKILL.md`,
				content: `---\n${yaml}---\n${appendSections("text" in body ? body.text : "", mapped.sections)}`,
				mode: (yield* fs.stat(skill.path)).mode & 0o777,
			},
		];
		for (const file of skill.files) {
			const absolute = path.join(dir, file);
			const mode = (yield* fs.stat(absolute)).mode & 0o777;
			if (!file.endsWith(".md")) {
				files.push({ path: `${out}/${file}`, content: yield* fs.readFile(absolute), mode });
				continue;
			}
			const processed = applyHostBlocks(toLf(yield* fs.readFileString(absolute)), id, known);
			if ("problem" in processed) {
				return yield* Effect.fail(
					invalid(absolute, [issue(`line ${processed.problem.line}`, processed.problem.message)]),
				);
			}
			files.push({ path: `${out}/${file}`, content: processed.text, mode });
		}
		return files;
	});
