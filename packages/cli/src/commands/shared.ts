// Flags and arguments more than one command takes, and the one rule they
// share: `--config` and `--all` together is a usage error.

import type { ConfigSelection } from "@pluginfinity/engine";
import { KNOWN_TARGET_IDS } from "@pluginfinity/targets";
import type { Option } from "effect";
import { Effect, FileSystem, Path } from "effect";
import { Argument, CliError, Flag } from "effect/cli";

/**
 * The process values a command needs, read once in `main.ts`.
 *
 * @public
 */
export interface LaunchFacts {
	/** The directory pluginfinity was launched in: where `[path]` resolves from. */
	readonly cwd: string;
	/** The running Node.js version, without a leading `v`. */
	readonly nodeVersion: string;
	/** The XDG state directory (`$XDG_STATE_HOME`, else `~/.local/state`): where `logs` finds `pluginfinity/<plugin>/`. */
	readonly stateHome: string;
}

/** `--target <id>`, repeatable. An unknown id is a usage error at parse time. */
export const targetFlag = Flag.Literals("target", KNOWN_TARGET_IDS).pipe(
	Flag.atLeast(0),
	Flag.withDescription("a target id; repeatable (default: every enabled target)"),
);

/** `--all`: every plugin config below `[path]`. */
export const allFlag = Flag.Boolean("all").pipe(
	Flag.withDefault(false),
	Flag.withDescription("every plugin config below path"),
);

/** `--config <file>`: an explicit config file, no discovery. */
export const configFlag = Flag.String("config").pipe(
	Flag.optional,
	Flag.withDescription("an explicit config file; no discovery"),
);

/** `[path]`: where config discovery starts. */
export const pathArgument = Argument.String("path").pipe(
	Argument.optional,
	Argument.withDescription("where config discovery starts (default: the current directory)"),
);

/**
 * Turn `[path]`, `--all` and `--config` into a selection, resolving relative
 * paths against the launch directory.
 */
export const toSelection = (
	launch: LaunchFacts,
	input: { readonly path: Option.Option<string>; readonly all: boolean; readonly config: Option.Option<string> },
): Effect.Effect<ConfigSelection, CliError.UserError, FileSystem.FileSystem | Path.Path> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		if (input.all && input.config._tag === "Some") {
			return yield* Effect.fail(new CliError.UserError({ cause: "--config and --all cannot be used together" }));
		}
		if (input.config._tag === "Some") return { _tag: "File", path: path.resolve(launch.cwd, input.config.value) };
		const start = path.resolve(launch.cwd, input.path._tag === "Some" ? input.path.value : ".");
		// A mistyped [path] must not fall through to a config further up the tree.
		if (input.path._tag === "Some" && !(yield* fs.exists(start).pipe(Effect.orElseSucceed(() => false)))) {
			return yield* Effect.fail(new CliError.UserError({ cause: `path "${input.path.value}" does not exist` }));
		}
		return input.all ? { _tag: "All", start } : { _tag: "Nearest", start };
	});
