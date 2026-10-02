import { NotImplemented } from "@pluginfinity/engine";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { checkPluginName } from "./name.js";
import { targetFlag } from "./shared.js";

/** `pluginfinity init [dir]`: create a plugin repository and its first plugin. A stub. */
export const initCommand = Command.make(
	"init",
	{
		dir: Argument.String("dir").pipe(
			Argument.optional,
			Argument.withDescription("where to create the repository (default: ./<name>/)"),
		),
		layout: Flag.Literals("layout", ["root", "plugin", "plugins"]).pipe(
			Flag.withDefault("root"),
			Flag.withDescription("where the plugin source lives"),
		),
		name: Flag.String("name").pipe(Flag.optional, Flag.withDescription("the first plugin's name")),
		pm: Flag.Literals("pm", ["pnpm", "npm", "yarn", "bun"]).pipe(
			Flag.withDefault("pnpm"),
			Flag.withDescription("the package manager"),
		),
		target: targetFlag,
		noChangesets: Flag.Boolean("no-changesets").pipe(
			Flag.withDefault(false),
			Flag.withDescription("skip the Changesets and versionFiles wiring"),
		),
		noCi: Flag.Boolean("no-ci").pipe(Flag.withDefault(false), Flag.withDescription("skip the CI workflow")),
		yes: Flag.Boolean("yes").pipe(Flag.withDefault(false), Flag.withDescription("accept defaults, no prompts")),
	},
	(input) =>
		Effect.gen(function* () {
			if (input.name._tag === "Some") yield* checkPluginName("--name", input.name.value);
			return yield* Effect.fail(new NotImplemented({ operation: "init" }));
		}),
).pipe(Command.withDescription("Create a plugin repository and its first plugin"));
