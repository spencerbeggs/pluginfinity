import { CurrentDistribution } from "@effected/engine";
import { Audience } from "@effected/env";
import type { LogFileName, LogTail } from "@pluginfinity/engine";
import { configPluginNames, listLogPlugins, logRoot, parseLogLine, readLog, readLogFrom } from "@pluginfinity/engine";
import type { Duration } from "effect";
import { Console, Context, Effect, FileSystem, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { reportFindings } from "../render/config-error.js";
import { entryJson, logsJson, logsLines, sectionHeader } from "../render/logs.js";
import { checkPluginName } from "./name.js";
import type { LaunchFacts } from "./shared.js";

/**
 * How `logs --follow` is bounded and paced. A run follows until interrupted;
 * a test, or a front end that owns the process, supplies its own.
 */
export interface FollowControl {
	/** Ends the follow when it completes; never, by default. */
	readonly stop: Effect.Effect<void>;
	/** How often the followed files are checked for appended lines. */
	readonly interval: Duration.Input;
	/** Called once when a follow starts, so a process boundary can end an interrupt with exit 0. */
	readonly onStart: () => void;
}

/** A follow that never stops by itself, checking twice a second. */
export const DEFAULT_FOLLOW: FollowControl = { stop: Effect.never, interval: "500 millis", onStart: () => {} };

/** The `FollowControl` a `logs --follow` runs under. */
export const CurrentFollow = Context.Reference<FollowControl>("@pluginfinity/cli/CurrentFollow", {
	defaultValue: () => DEFAULT_FOLLOW,
});

/** The plugin names to read: `--plugin`, else the nearest config's, else every directory under the state directory. */
const resolvePlugins = (launch: LaunchFacts, explicit: ReadonlyArray<string>) =>
	explicit.length > 0
		? Effect.succeed(explicit)
		: configPluginNames({ _tag: "Nearest", start: launch.cwd }).pipe(
				Effect.catchTag("ConfigNotFound", () => listLogPlugins(launch.stateHome)),
			);

/** Print lines appended to the followed files until `stop` completes, checking every `interval`. */
const follow = (
	tails: ReadonlyArray<LogTail>,
	control: FollowControl,
	print: (tail: LogTail, line: string) => Effect.Effect<void>,
) =>
	Effect.gen(function* () {
		const offsets = new Map(tails.map((tail) => [tail.path, tail.offset]));
		yield* Effect.forever(
			Effect.gen(function* () {
				for (const tail of tails) {
					const next = yield* readLogFrom(tail.path, offsets.get(tail.path) ?? 0);
					offsets.set(tail.path, next.offset);
					for (const line of next.lines) yield* print(tail, line);
				}
				yield* Effect.sleep(control.interval);
			}),
		);
	}).pipe((loop) => Effect.raceFirst(loop, control.stop));

/** `pluginfinity logs`: read the logs plugins write under the XDG state directory. */
export const logsCommand = (launch: LaunchFacts) =>
	Command.make(
		"logs",
		{
			plugin: Flag.String("plugin").pipe(
				Flag.atLeast(0),
				Flag.withDescription("a plugin name; repeatable (default: the config's plugins, else every plugin with logs)"),
			),
			debug: Flag.Boolean("debug").pipe(
				Flag.withDefault(false),
				Flag.withDescription("show debug.log instead of error.log"),
			),
			follow: Flag.Boolean("follow").pipe(
				Flag.withAlias("f"),
				Flag.withDefault(false),
				Flag.withDescription("keep printing lines as they are appended, until interrupted"),
			),
			lines: Flag.Int("lines").pipe(
				Flag.withAlias("n"),
				Flag.filter(
					(n) => n >= 0,
					(n) => `--lines must be zero or more, got ${n}`,
				),
				Flag.withDefault(50),
				Flag.withDescription("how many of the last lines of each file to show"),
			),
		},
		(input) =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const audience = yield* Audience;
				const human = audience.kind === "human";
				const file: LogFileName = input.debug ? "debug.log" : "error.log";
				// A name becomes a path segment under the state directory, so it must be a plugin name.
				const explicit = yield* Effect.forEach(input.plugin, (name) => checkPluginName("--plugin", name));
				const plugins = yield* resolvePlugins(launch, explicit);
				const root = yield* logRoot(launch.stateHome);
				const rootExists = yield* fs.exists(root);
				const tails: Array<LogTail> = [];
				for (const plugin of plugins) {
					tails.push(yield* readLog({ stateHome: launch.stateHome, plugin, file, lines: input.lines }));
				}
				const view = { root, rootExists, tails, limit: input.lines };

				if (!input.follow) {
					if (human) {
						for (const line of logsLines(view)) yield* Console.log(line);
					} else {
						yield* Console.log(logsJson(view, Option.getOrNull(yield* CurrentDistribution)));
					}
					return;
				}

				// Following: the tail first, then each appended line as it lands. An agent
				// reads one JSON object per line; a person sees a header whenever the file changes.
				const control = yield* CurrentFollow;
				// Before the tail prints, so an interrupt during it also ends with exit 0.
				control.onStart();
				let shown: string | undefined;
				if (human) {
					for (const line of logsLines(view)) yield* Console.log(line);
					const last = tails.at(-1);
					shown = last === undefined ? undefined : last.path;
				} else {
					for (const tail of tails) {
						for (const line of tail.lines) yield* Console.log(entryJson(parseLogLine(line, tail.plugin, tail.file)));
					}
				}
				yield* follow(tails, control, (tail, line) =>
					Effect.gen(function* () {
						if (!human) return yield* Console.log(entryJson(parseLogLine(line, tail.plugin, tail.file)));
						if (shown !== tail.path) {
							shown = tail.path;
							yield* Console.log(sectionHeader(tail.plugin, tail.file));
						}
						yield* Console.log(line);
					}),
				);
			}).pipe(reportFindings),
	).pipe(
		Command.withDescription("Show the logs plugins write under the XDG state directory, optionally following them"),
	);
