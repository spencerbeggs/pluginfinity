import type { PlatformError } from "effect";
import { Effect, FileSystem, Path, Schema } from "effect";

/**
 * The mode every generated file is written with.
 *
 * @public
 */
export const GENERATED_MODE = 0o644;

const encoder = new TextEncoder();

/**
 * One file a build produces: a `/`-separated path relative to the output
 * directory, its text or bytes, and its mode.
 *
 * @public
 */
export interface EmittedFile {
	readonly path: string;
	readonly content: string | Uint8Array;
	/** The permission bits; a generated file's are {@link GENERATED_MODE}, a copied file keeps its source's. */
	readonly mode?: number;
}

const bytesOf = (file: EmittedFile): Uint8Array =>
	typeof file.content === "string" ? encoder.encode(file.content) : file.content;

const modeOf = (file: EmittedFile): number => file.mode ?? GENERATED_MODE;

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
	/** On disk, no longer produced; an empty directory ends in `/`. */
	removed: Schema.Array(Schema.String),
	/** On disk with the same bytes and mode; never touched, so its mtime stays. */
	unchanged: Schema.Array(Schema.String),
}) {
	/** Whether the output directory already matches the build. */
	get clean(): boolean {
		return this.added.length === 0 && this.changed.length === 0 && this.removed.length === 0;
	}
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
	a.length === b.length && a.every((byte, i) => byte === b[i]);

/**
 * Every non-directory under `dir`, and every empty directory with a trailing
 * `/`, as sorted `/`-separated relative paths. A build never produces an empty
 * directory, so one on disk is always a leftover to remove.
 */
const inventory = (
	dir: string,
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		if (!(yield* fs.exists(dir))) return [];
		const files: Array<string> = [];
		for (const entry of yield* fs.readDirectory(dir, { recursive: true })) {
			const absolute = path.join(dir, entry);
			const relative = entry.split(path.sep).join("/");
			if ((yield* fs.stat(absolute)).type !== "Directory") files.push(relative);
			else if ((yield* fs.readDirectory(absolute)).length === 0) files.push(`${relative}/`);
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
				(info.mode & 0o777) === modeOf(file) &&
				sameBytes(yield* fs.readFile(target), bytesOf(file));
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
 * leaves `dir` untouched; then delete removed files and prune the directories
 * they leave empty; then move each staged file into place. Unchanged files are
 * never written.
 *
 * @remarks
 * Removals run before the moves. A path that changes only by case is a
 * removal and an addition naming the same file on a case-insensitive
 * filesystem, so moving first and removing second deletes the new file. A
 * path that turns from a file into a directory, or back, cannot be moved into
 * place while the old entry still stands.
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
				yield* fs.writeFile(target, bytesOf(file));
				yield* fs.chmod(target, modeOf(file));
			}
			for (const file of plan.removed) {
				yield* fs.remove(path.join(dir, file), { recursive: file.endsWith("/") });
				let current = path.dirname(path.join(dir, file));
				while (current !== dir && current.startsWith(dir) && (yield* fs.readDirectory(current)).length === 0) {
					// Empty, so recursive removes nothing but the directory itself.
					yield* fs.remove(current, { recursive: true });
					current = path.dirname(current);
				}
			}
			for (const file of staged) {
				const target = path.join(dir, file.path);
				yield* fs.makeDirectory(path.dirname(target), { recursive: true });
				yield* fs.rename(path.join(staging, file.path), target);
			}
		}),
	);
