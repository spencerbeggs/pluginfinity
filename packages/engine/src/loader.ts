import type { KnownTargetId } from "@pluginfinity/targets";
import { CONFIG_KEYS, KNOWN_TARGET_IDS, PluginfinityConfig, enabledTargets } from "@pluginfinity/targets";
import { Effect, Path, Schema, SchemaIssue } from "effect";
import { createJiti } from "jiti";
import { ConfigInvalid, ConfigIssue, ConfigLoadFailed, UnknownTarget } from "./errors.js";

/**
 * A config that loaded, decoded and enables at least one target.
 *
 * @public
 */
export interface LoadedConfig {
	/** The config file's absolute path. */
	readonly path: string;
	/** The config's directory: the plugin root. */
	readonly root: string;
	readonly config: PluginfinityConfig;
	/** The enabled targets, in registry order. */
	readonly targets: ReadonlyArray<KnownTargetId>;
}

const firstLine = (cause: unknown): string => {
	const text = cause instanceof Error ? cause.message : String(cause);
	return text.split("\n")[0]?.trim() ?? text;
};

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

const importDefault = (path: string): Effect.Effect<unknown, ConfigLoadFailed | ConfigInvalid> =>
	Effect.tryPromise({
		// No module or transform cache: a config edited between two loads in one
		// process is read again, and nothing is written under node_modules/.cache.
		// No default interop: jiti's proxy throws on `export default null`, and
		// the plain namespace lets `"default" in mod` tell a missing export apart.
		try: () =>
			createJiti(path, { fsCache: false, moduleCache: false, interopDefault: false }).import<Record<string, unknown>>(
				path,
			),
		catch: (cause) => new ConfigLoadFailed({ path, detail: firstLine(cause) }),
	}).pipe(
		Effect.flatMap((mod) =>
			"default" in mod
				? Effect.succeed(mod.default)
				: Effect.fail(
						new ConfigInvalid({
							path,
							issues: [ConfigIssue.make({ key: "", message: "the config has no default export" })],
						}),
					),
		),
	);

/**
 * Loading one config file through jiti.
 *
 * @public
 */
export class ConfigLoader {
	private constructor() {}

	/**
	 * Import `path`, take its default export, reject unknown top-level keys,
	 * decode it against `PluginfinityConfig`, and require at least one target.
	 */
	static readonly load = (
		path: string,
	): Effect.Effect<LoadedConfig, ConfigLoadFailed | ConfigInvalid | UnknownTarget, Path.Path> =>
		Effect.gen(function* () {
			const paths = yield* Path.Path;
			const value = yield* importDefault(path);

			if (typeof value === "object" && value !== null && !Array.isArray(value)) {
				const unknown = Object.keys(value).filter((key) => !CONFIG_KEYS.includes(key));
				if (unknown.length > 0) {
					return yield* Effect.fail(new UnknownTarget({ path, targets: unknown, known: [...KNOWN_TARGET_IDS] }));
				}
			}

			const config = yield* Schema.decodeUnknownEffect(PluginfinityConfig)(value, {
				errors: "all",
				onExcessProperty: "error",
			}).pipe(
				Effect.mapError(
					(error) =>
						new ConfigInvalid({
							path,
							issues: formatter(error.issue).issues.map((issue) =>
								ConfigIssue.make({
									key: (issue.path ?? []).map((segment) => String(segment)).join("."),
									message: issue.message,
								}),
							),
						}),
				),
			);

			const targets = enabledTargets(config);
			if (targets.length === 0) {
				return yield* Effect.fail(
					new ConfigInvalid({
						path,
						issues: [
							ConfigIssue.make({
								key: "",
								message: `no target is enabled; add at least one of: ${KNOWN_TARGET_IDS.join(", ")}`,
							}),
						],
					}),
				);
			}

			return { path, root: paths.dirname(path), config, targets };
		});
}
