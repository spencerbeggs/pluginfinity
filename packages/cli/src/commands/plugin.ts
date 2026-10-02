import { NotImplemented } from "@pluginfinity/engine";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { checkPluginName } from "./name.js";
import { targetFlag } from "./shared.js";

/** `pluginfinity plugin add <name>`: add a plugin source. A stub. */
const addCommand = Command.make(
	"add",
	{
		name: Argument.String("name").pipe(Argument.withDescription("the new plugin's name")),
		target: targetFlag,
		dir: Flag.String("dir").pipe(
			Flag.optional,
			Flag.withDescription("where the plugin goes (default: plugins/<name>)"),
		),
	},
	(input) =>
		Effect.gen(function* () {
			yield* checkPluginName("plugin name", input.name);
			return yield* Effect.fail(new NotImplemented({ operation: "plugin add" }));
		}),
).pipe(Command.withDescription("Add a plugin source"));

/** `pluginfinity plugin`: the plugin group. A bare invocation prints its help. */
export const pluginCommand = Command.make("plugin").pipe(
	Command.withDescription("Manage the plugins in this repository"),
	Command.withSubcommands([addCommand]),
);
