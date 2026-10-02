import { GlobPattern } from "@effected/glob";
import { Walker, descend } from "@effected/walker";
import { Effect, FileSystem, Path } from "effect";
import { ConfigAmbiguous, ConfigNotFound } from "./errors.js";

/**
 * The config file names discovery looks for, in preference order.
 *
 * @public
 */
export const CONFIG_FILE_NAMES = [
	"pluginfinity.config.ts",
	"pluginfinity.config.mts",
	"pluginfinity.config.js",
	"pluginfinity.config.mjs",
] as const;

// Directories `--all` never descends into: dependencies, build output, git.
const ALL_PRUNE = ["node_modules", "builds", ".git"];

const exists = (fs: FileSystem.FileSystem, path: string): Effect.Effect<boolean> =>
	fs.exists(path).pipe(Effect.orElseSucceed(() => false));

/**
 * Finding `pluginfinity.config.*` files. Every member takes its start directory
 * as an absolute path and never reads the process working directory.
 *
 * @public
 */
export class ConfigDiscovery {
	private constructor() {}

	/**
	 * The nearest config at or above `start`, stopping after the first
	 * directory that contains `.git`.
	 */
	static readonly nearest = (
		start: string,
	): Effect.Effect<string, ConfigNotFound | ConfigAmbiguous, FileSystem.FileSystem | Path.Path> =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			for (const dir of yield* Walker.ascend(start)) {
				const found: Array<string> = [];
				for (const name of CONFIG_FILE_NAMES) {
					if (yield* exists(fs, path.join(dir, name))) found.push(name);
				}
				if (found.length > 1) return yield* Effect.fail(new ConfigAmbiguous({ path: dir, files: found }));
				const [only] = found;
				if (only !== undefined) return path.join(dir, only);
				if (yield* exists(fs, path.join(dir, ".git"))) break;
			}
			return yield* Effect.fail(new ConfigNotFound({ path: start }));
		});

	/**
	 * Every config at or below `start`, sorted, skipping `node_modules`,
	 * `builds` and `.git`. An empty result is not an error here.
	 */
	static readonly all = (
		start: string,
	): Effect.Effect<ReadonlyArray<string>, ConfigAmbiguous, FileSystem.FileSystem | Path.Path> =>
		Effect.gen(function* () {
			const path = yield* Path.Path;
			// A constant, valid pattern: a compile failure is a bug, not an input error.
			const pattern = yield* GlobPattern.compile("**/pluginfinity.config.{ts,mts,js,mjs}").pipe(Effect.orDie);
			// `skip` absorbs unreadable directories; the remaining failure is the
			// 256-level depth cap, which no plugin repository reaches.
			const relative = yield* descend(pattern, { cwd: start, prune: ALL_PRUNE, onUnreadable: "skip" }).pipe(
				Effect.orDie,
			);
			const byDir = new Map<string, Array<string>>();
			for (const file of relative) {
				const absolute = path.join(start, file);
				const dir = path.dirname(absolute);
				byDir.set(dir, [...(byDir.get(dir) ?? []), path.basename(absolute)]);
			}
			for (const [dir, files] of byDir) {
				if (files.length > 1) return yield* Effect.fail(new ConfigAmbiguous({ path: dir, files }));
			}
			return relative.map((file) => path.join(start, file));
		});
}
