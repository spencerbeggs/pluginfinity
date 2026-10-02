import type { KnownTargetId } from "@pluginfinity/targets";
import type { FileSystem, Path } from "effect";
import { Effect } from "effect";
import type { ConfigError } from "./errors.js";
import { NotImplemented } from "./errors.js";
import type { ConfigSelection } from "./selection.js";
import { preparePlugins } from "./selection.js";

/**
 * The input to `build`.
 *
 * @public
 */
export interface BuildInput {
	readonly selection: ConfigSelection;
	readonly targets: ReadonlyArray<KnownTargetId>;
	/** Rebuild in memory and compare with `builds/` instead of writing. */
	readonly check: boolean;
}

/**
 * The input to `validate`.
 *
 * @public
 */
export interface ValidateInput {
	readonly selection: ConfigSelection;
	readonly targets: ReadonlyArray<KnownTargetId>;
	/** Skip the host CLIs and run only pluginfinity's own checks. */
	readonly skipHosts: boolean;
}

/**
 * Regenerate `builds/<id>/`. Runs the real front half (find, load, check the
 * targets), then stops with `NotImplemented`.
 *
 * @public
 */
export const build = (
	input: BuildInput,
): Effect.Effect<never, ConfigError | NotImplemented, FileSystem.FileSystem | Path.Path> =>
	preparePlugins(input).pipe(Effect.andThen(Effect.fail(new NotImplemented({ operation: "build" }))));

/**
 * Validate the plugin. Runs the real front half, then stops with
 * `NotImplemented`.
 *
 * @public
 */
export const validate = (
	input: ValidateInput,
): Effect.Effect<never, ConfigError | NotImplemented, FileSystem.FileSystem | Path.Path> =>
	preparePlugins(input).pipe(Effect.andThen(Effect.fail(new NotImplemented({ operation: "validate" }))));
