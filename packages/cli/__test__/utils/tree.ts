import type { Scope } from "effect";
import { Effect, FileSystem, Path } from "effect";

/**
 * Write `files` (relative path to content) under a fresh temporary directory
 * that is removed when the scope closes, and return the directory's real path.
 */
export const writeTree = (
	files: Readonly<Record<string, string>>,
): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path | Scope.Scope> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		// realPath: on macOS the temp dir is reached through the /var symlink.
		const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "pluginfinity-cli-" }));
		for (const [file, content] of Object.entries(files)) {
			const target = path.join(root, file);
			yield* fs.makeDirectory(path.dirname(target), { recursive: true });
			yield* fs.writeFileString(target, content);
		}
		return root;
	}).pipe(Effect.orDie);
