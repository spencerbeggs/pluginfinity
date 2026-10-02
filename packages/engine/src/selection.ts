import type { KnownTargetId } from "@pluginfinity/targets";
import type { Path } from "effect";
import { Effect, FileSystem } from "effect";
import { ConfigDiscovery } from "./discovery.js";
import type { ConfigError } from "./errors.js";
import { ConfigNotFound, TargetNotEnabled } from "./errors.js";
import type { LoadedConfig } from "./loader.js";
import { ConfigLoader } from "./loader.js";

/**
 * Which configs an operation runs against. A front end builds it from
 * `[path]`, `--config` and `--all`; using `--config` and `--all` together is
 * the front end's usage error to report, so a selection never holds both.
 *
 * @public
 */
export type ConfigSelection =
	/** The nearest config at or above `start`. */
	| { readonly _tag: "Nearest"; readonly start: string }
	/** Every config at or below `start`. */
	| { readonly _tag: "All"; readonly start: string }
	/** Exactly this file, no discovery. */
	| { readonly _tag: "File"; readonly path: string };

/**
 * The config paths a selection names, before loading. `All` with no match is
 * `ConfigNotFound`.
 *
 * @public
 */
export const selectConfigPaths = (
	selection: ConfigSelection,
): Effect.Effect<ReadonlyArray<string>, ConfigError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		switch (selection._tag) {
			case "Nearest":
				return [yield* ConfigDiscovery.nearest(selection.start)];
			case "All": {
				const paths = yield* ConfigDiscovery.all(selection.start);
				if (paths.length === 0) return yield* Effect.fail(new ConfigNotFound({ path: selection.start }));
				return paths;
			}
			case "File": {
				const fs = yield* FileSystem.FileSystem;
				const found = yield* fs.exists(selection.path).pipe(Effect.orElseSucceed(() => false));
				if (!found) return yield* Effect.fail(new ConfigNotFound({ path: selection.path, explicit: true }));
				return [selection.path];
			}
		}
	});

/**
 * A loaded config and the targets an operation will run for it.
 *
 * @public
 */
export interface PreparedPlugin {
	readonly config: LoadedConfig;
	readonly targets: ReadonlyArray<KnownTargetId>;
}

/**
 * The front half every config-driven operation shares: select, load, and
 * check the requested targets. An empty `targets` means every enabled target.
 *
 * @public
 */
export const preparePlugins = (input: {
	readonly selection: ConfigSelection;
	readonly targets: ReadonlyArray<KnownTargetId>;
}): Effect.Effect<ReadonlyArray<PreparedPlugin>, ConfigError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const paths = yield* selectConfigPaths(input.selection);
		const prepared: Array<PreparedPlugin> = [];
		for (const path of paths) {
			const config = yield* ConfigLoader.load(path);
			for (const target of input.targets) {
				if (!config.targets.includes(target)) {
					return yield* Effect.fail(new TargetNotEnabled({ path, target, enabled: [...config.targets] }));
				}
			}
			prepared.push({ config, targets: input.targets.length === 0 ? config.targets : input.targets });
		}
		return prepared;
	});
