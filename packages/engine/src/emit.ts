import type { PlatformError } from "effect";
import { Effect, FileSystem, Path, Schema } from "effect";

/**
 * The mode every generated file is written with.
 *
 * @public
 */
export const GENERATED_MODE = 0o644;

/**
 * One file a build produces: a `/`-separated path relative to the output
 * directory, and its text.
 *
 * @public
 */
export interface EmittedFile {
	readonly path: string;
	readonly content: string;
}

/**
 * How an output directory differs from what a build produces. Every list is
 * sorted and holds `/`-separated paths relative to the output directory.
 *
 * @public
 */
export class EmitPlan extends Schema.Class<EmitPlan>("EmitPlan")({
	/** Produced, not on disk. */
	added: Schema.Array(Schema.String),
	/** On disk with other bytes or another mode. */
	changed: Schema.Array(Schema.String),
	/** On disk, no longer produced. */
	removed: Schema.Array(Schema.String),
	/** On disk with the same bytes and mode; never touched, so its mtime stays. */
	unchanged: Schema.Array(Schema.String),
}) {
	/** Whether the output directory already matches the build. */
	get clean(): boolean {
		return this.added.length === 0 && this.changed.length === 0 && this.removed.length === 0;
	}
}

const encoder = new TextEncoder();

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
	a.length === b.length && a.every((byte, i) => byte === b[i]);

/** Every non-directory under `dir`, as sorted `/`-separated relative paths. */
const inventory = (
	dir: string,
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		if (!(yield* fs.exists(dir))) return [];
		const files: Array<string> = [];
		for (const entry of yield* fs.readDirectory(dir, { recursive: true })) {
			const info = yield* fs.stat(path.join(dir, entry));
			if (info.type !== "Directory") files.push(entry.split(path.sep).join("/"));
		}
		return files.sort();
	});

/**
 * Compare `files` with what `dir` holds, reading only.
 *
 * @public
 */
export const planEmit = (
	dir: string,
	files: ReadonlyArray<EmittedFile>,
): Effect.Effect<EmitPlan, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const existing = new Set(yield* inventory(dir));
		const added: Array<string> = [];
		const changed: Array<string> = [];
		const unchanged: Array<string> = [];
		for (const file of files) {
			if (!existing.has(file.path)) {
				added.push(file.path);
				continue;
			}
			const target = path.join(dir, file.path);
			const info = yield* fs.stat(target);
			const same =
				info.type === "File" &&
				(info.mode & 0o777) === GENERATED_MODE &&
				sameBytes(yield* fs.readFile(target), encoder.encode(file.content));
			(same ? unchanged : changed).push(file.path);
		}
		const produced = new Set(files.map((file) => file.path));
		const removed = [...existing].filter((file) => !produced.has(file));
		return EmitPlan.make({
			added: added.sort(),
			changed: changed.sort(),
			removed,
			unchanged: unchanged.sort(),
		});
	});

/**
 * Bring `dir` in line with `files` according to `plan`: stage every added and
 * changed file in a sibling temporary directory first, so a failed write
 * leaves `dir` untouched, then move each into place, delete removed files and
 * prune the directories they leave empty. Unchanged files are never written.
 *
 * @public
 */
export const applyEmit = (
	dir: string,
	files: ReadonlyArray<EmittedFile>,
	plan: EmitPlan,
): Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.scoped(
		Effect.gen(function* () {
			if (plan.clean) return;
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const parent = path.dirname(dir);
			yield* fs.makeDirectory(parent, { recursive: true });
			// A sibling of dir, so each move is a same-filesystem rename.
			const staging = yield* fs.makeTempDirectoryScoped({ directory: parent, prefix: ".pluginfinity-" });
			const writes = new Set([...plan.added, ...plan.changed]);
			const staged = files.filter((file) => writes.has(file.path));
			for (const file of staged) {
				const target = path.join(staging, file.path);
				yield* fs.makeDirectory(path.dirname(target), { recursive: true });
				yield* fs.writeFileString(target, file.content);
				yield* fs.chmod(target, GENERATED_MODE);
			}
			for (const file of staged) {
				const target = path.join(dir, file.path);
				yield* fs.makeDirectory(path.dirname(target), { recursive: true });
				yield* fs.rename(path.join(staging, file.path), target);
			}
			for (const file of plan.removed) {
				yield* fs.remove(path.join(dir, file));
				let current = path.dirname(path.join(dir, file));
				while (current !== dir && current.startsWith(dir) && (yield* fs.readDirectory(current)).length === 0) {
					// Empty, so recursive removes nothing but the directory itself.
					yield* fs.remove(current, { recursive: true });
					current = path.dirname(current);
				}
			}
		}),
	);
