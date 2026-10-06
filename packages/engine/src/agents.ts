import type { Target } from "@pluginfinity/core";
import { AGENT_FIELDS, AgentFrontmatter } from "@pluginfinity/core";
import type { KnownTargetId } from "@pluginfinity/targets";
import type { PlatformError } from "effect";
import { Effect, FileSystem, Path } from "effect";
import { applyHostBlocks } from "./body.js";
import { decodeComponent, frontmatterText, invalid, issue, overlayIssues, unknownTargets } from "./component.js";
import type { EmittedFile } from "./emit.js";
import type { ComponentInvalid, ConfigIssue } from "./errors.js";
import { appendSections, mapFrontmatter } from "./frontmatter.js";
import type { BuildNote } from "./notes.js";

/**
 * One agent as read from `agents/<name>.md`: its name, its decoded
 * frontmatter and its body.
 *
 * @public
 */
export interface SourceAgent {
	/** The file stem, which is the agent's name. */
	readonly name: string;
	/** The absolute path of its file. */
	readonly path: string;
	readonly frontmatter: typeof AgentFrontmatter.Type;
	/** The frontmatter as written, without its fences. */
	readonly frontmatterText: string;
	/** Everything after the closing frontmatter fence, unchanged. */
	readonly body: string;
	/** The file lines before the body. */
	readonly bodyOffset: number;
}

/** Read and decode one agent file. */
const readAgent = (
	file: string,
	name: string,
	known: ReadonlyArray<string>,
): Effect.Effect<SourceAgent, ComponentInvalid | PlatformError.PlatformError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const {
			frontmatter,
			frontmatterText: text,
			body,
			bodyOffset,
		} = yield* decodeComponent(file, yield* fs.readFileString(file), AgentFrontmatter);
		const problems: Array<ConfigIssue> = [
			...(frontmatter.name === name ? [] : [issue("name", `must equal the file name "${name}"`)]),
			...unknownTargets(frontmatter.targets, known),
		];
		if (problems.length > 0) return yield* Effect.fail(invalid(file, problems));
		return { name, path: file, frontmatter, frontmatterText: text, body, bodyOffset };
	});

/**
 * Read every agent under `<root>/agents/`, sorted by name; none when the
 * directory is absent. An agent whose frontmatter does not decode, whose
 * `name` differs from its file stem, or whose `targets` block names an
 * unknown target is collected in `failures` rather than stopping the read,
 * so one build reports them all.
 *
 * @public
 */
export const readAgents = (
	root: string,
	known: ReadonlyArray<string>,
): Effect.Effect<
	{ readonly agents: ReadonlyArray<SourceAgent>; readonly failures: ReadonlyArray<ComponentInvalid> },
	PlatformError.PlatformError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const dir = path.join(root, "agents");
		if (!(yield* fs.exists(dir))) return { agents: [], failures: [] };
		const agents: Array<SourceAgent> = [];
		const failures: Array<ComponentInvalid> = [];
		for (const entry of (yield* fs.readDirectory(dir)).sort()) {
			const file = path.join(dir, entry);
			if (!entry.endsWith(".md") || (yield* fs.stat(file)).type !== "File") continue;
			const agent = yield* readAgent(file, entry.slice(0, -".md".length), known).pipe(
				Effect.catchTag("ComponentInvalid", (error) => Effect.sync(() => void failures.push(error))),
			);
			if (agent !== undefined) agents.push(agent);
		}
		return { agents, failures };
	});

/**
 * An agent rendered for a target: its file, and what the target dropped or
 * degraded from its frontmatter.
 *
 * @public
 */
export interface RenderedAgent {
	readonly file: EmittedFile;
	/** Each about `agents/<name>.md`, in the order met. */
	readonly notes: ReadonlyArray<BuildNote>;
}

/**
 * Render one agent for a target, or `undefined` when its `targets` block
 * excludes it: the file at `<agents.dir>/<name><agents.suffix>` with the
 * target's frontmatter, degraded fields appended as body sections, and host
 * blocks applied. It keeps its source mode.
 *
 * @public
 */
export const renderAgent = (
	target: Target,
	id: KnownTargetId,
	agent: SourceAgent,
	known: ReadonlyArray<string>,
): Effect.Effect<RenderedAgent | undefined, ComponentInvalid | PlatformError.PlatformError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const block = agent.frontmatter.targets?.[id];
		if (block === false) return undefined;
		const mapped = mapFrontmatter(
			target,
			target.agents.fields,
			target.agents.hostFields,
			agent.frontmatter,
			block ?? {},
		);
		const problems: Array<ConfigIssue> = [
			...(yield* overlayIssues(AgentFrontmatter, AGENT_FIELDS, agent.frontmatter, block ?? {}, id)),
			...mapped.unresolved.map((field) => issue(field.field, `${id} leaves this field unresolved (${field.note})`)),
			...mapped.unknown.map((key) => issue(`targets.${id}.${key}`, `not an agent field or a ${id} agent field`)),
		];
		// A malformed host block is wrong for every target, so it names none.
		const body = applyHostBlocks(agent.body, id, known);
		if ("problem" in body) {
			return yield* Effect.fail(
				invalid(agent.path, [issue(`line ${body.problem.line + agent.bodyOffset}`, body.problem.message)]),
			);
		}
		if (problems.length > 0) return yield* Effect.fail(invalid(agent.path, problems, id));

		const { name: _name, description, ...rest } = mapped.fields;
		const yaml = yield* frontmatterText({ name: agent.name, description, ...rest }, agent);
		const source = `agents/${agent.name}.md`;
		return {
			file: {
				path: `${target.agents.dir}/${agent.name}${target.agents.suffix}`,
				content: `---\n${yaml}---\n${appendSections(body.text, mapped.sections)}`,
				mode: (yield* fs.stat(agent.path)).mode & 0o777,
			},
			notes: mapped.drops.map(({ field, kind }) => ({ target: id, path: source, kind, name: field })),
		};
	});
