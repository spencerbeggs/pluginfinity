import { Schema } from "effect";
import { PluginRelativePath } from "./hooks.js";
import { KebabName } from "./name.js";

/**
 * A monitor's name: kebab-case, the key it is written under.
 *
 * @public
 */
export const MonitorName = KebabName;

/**
 * When a monitor starts: `"always"` (the default) or the first time a named
 * skill is invoked, as `on-skill-invoke:<skill>`.
 *
 * @public
 */
export const MonitorWhen = Schema.Union([
	Schema.Literal("always"),
	Schema.String.check(
		Schema.isPattern(/^on-skill-invoke:.+$/, {
			message: 'must be "always" or "on-skill-invoke:<skill>"',
		}),
	),
]);

const sharedMonitorFields = {
	/** What the monitor watches, shown by the host. */
	description: Schema.String.check(Schema.isMinLength(1)),
	/** When the monitor starts. Defaults to `"always"`. */
	when: Schema.optionalKey(MonitorWhen),
};

/**
 * A monitor that runs a script the plugin ships. Each line it prints to
 * stdout is delivered to the model.
 *
 * @public
 */
export const ScriptMonitor = Schema.Struct({
	script: PluginRelativePath,
	args: Schema.optionalKey(Schema.Array(Schema.String)),
	...sharedMonitorFields,
});

/**
 * A monitor given as a command string. `${PLUGIN_ROOT}` is its one placeholder.
 *
 * @public
 */
export const CommandMonitor = Schema.Struct({
	command: Schema.String.check(Schema.isMinLength(1)),
	...sharedMonitorFields,
});

/**
 * One monitor: exactly one of `script` or `command`. Decode strictly, or a
 * mixed entry decodes as whichever member matches first.
 *
 * @public
 */
export const MonitorEntry = Schema.Union([ScriptMonitor, CommandMonitor]);

/**
 * The decoded `MonitorEntry`.
 *
 * @public
 */
export type MonitorEntry = typeof MonitorEntry.Type;

/**
 * A plugin's monitors, keyed by name.
 *
 * @public
 */
export const Monitors = Schema.Record(MonitorName, MonitorEntry);
