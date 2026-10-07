import type { MonitorEntry, Target } from "@pluginfinity/core";
import type { KnownTargetId, PluginfinityConfig } from "@pluginfinity/targets";
import { ConfigIssue } from "./errors.js";
import { commandFiles, hookCommand, shellEnvPrefix } from "./hooks.js";
import type { BuildNote } from "./notes.js";
import { CONFIG_NOTE_PATH } from "./notes.js";

/**
 * Monitors by name.
 *
 * @public
 */
export type MonitorMap = Readonly<Record<string, MonitorEntry>>;

/**
 * The monitors a target builds: the base `monitors` with the target's own
 * replacing the base monitor of the same name.
 *
 * @public
 */
export const targetMonitors = (id: KnownTargetId, config: PluginfinityConfig): MonitorMap => {
	const setting = config[id];
	return { ...config.monitors, ...(typeof setting === "object" ? setting.monitors : undefined) };
};

/**
 * What a target builds of its monitors, before the build checks and ships the files.
 *
 * @public
 */
export interface RenderedMonitors {
	/** The monitors file, or none when the target has no monitors or the plugin sets none. */
	readonly file?: { readonly path: string; readonly content: string };
	readonly notes: ReadonlyArray<BuildNote>;
	/** Each `when` that names a skill this target does not build, keyed `monitors.<name>.when`. */
	readonly issues: ReadonlyArray<ConfigIssue>;
	/** Every `script` the monitors run, plugin-relative. */
	readonly scripts: ReadonlyArray<string>;
	/** Every file a `command` monitor names as `${PLUGIN_ROOT}/<path>`. */
	readonly commandFiles: ReadonlyArray<string>;
}

/**
 * What a monitor's `when` may name: the plugin's name on the target, and the skills it builds.
 *
 * @public
 */
export interface MonitorContext {
	readonly plugin: string;
	readonly skills: ReadonlySet<string>;
}

const SKILL_WHEN = "on-skill-invoke:";

/**
 * Render a target's monitors file. A target with no monitors drops every
 * monitor with a `monitor-omitted` note and ships neither file nor script.
 *
 * @remarks
 * Each entry's command carries `PLUGINFINITY_MONITOR` (the monitor's name,
 * which the monitor library logs under), quoted by `shellEnvPrefix`: a prefix
 * on a script, an `export` before a command.
 *
 * A `when` of `on-skill-invoke:<skill>` is written `on-skill-invoke:<plugin>:<skill>`: Claude
 * Code matches the plugin-qualified skill name only, and a bare name never starts the monitor.
 * A skill the target does not build is an issue, since the monitor would never start.
 *
 * @public
 */
export const renderMonitors = (
	target: Target,
	id: KnownTargetId,
	monitors: MonitorMap,
	invoke: "bash" | "exec",
	context: MonitorContext,
): RenderedMonitors => {
	const entries = Object.entries(monitors);
	if (entries.length === 0) return { notes: [], issues: [], scripts: [], commandFiles: [] };
	const placement = target.monitors;
	if (!("path" in placement)) {
		return {
			notes: entries.map(([name]) => ({ target: id, path: CONFIG_NOTE_PATH, kind: "monitor-omitted", name })),
			issues: [],
			scripts: [],
			commandFiles: [],
		};
	}
	const issues: Array<ConfigIssue> = [];
	const array = entries.map(([name, entry]) => {
		const env = shellEnvPrefix({ PLUGINFINITY_MONITOR: name });
		// A script runs with the variable as a prefix, a command after an `export`.
		const command =
			"script" in entry
				? `${env}${hookCommand(entry, placement.root, invoke)}`
				: `export ${env.trimEnd()}; ${hookCommand(entry, placement.root, invoke)}`;
		let when = entry.when;
		if (when !== undefined && when.startsWith(SKILL_WHEN)) {
			const skill = when.slice(SKILL_WHEN.length);
			if (!context.skills.has(skill)) {
				issues.push(
					ConfigIssue.make({
						key: `monitors.${name}.when`,
						message: `names the skill "${skill}", which this plugin does not build for ${id}`,
					}),
				);
			}
			when = `${SKILL_WHEN}${context.plugin}:${skill}`;
		}
		return {
			name,
			command,
			description: entry.description,
			...(when === undefined ? {} : { when }),
		};
	});
	return {
		file: { path: placement.path, content: `${JSON.stringify(array, null, "\t")}\n` },
		notes: [],
		issues,
		scripts: [...new Set(entries.flatMap(([, entry]) => ("script" in entry ? [entry.script] : [])))],
		commandFiles: [...new Set(entries.flatMap(([, entry]) => ("command" in entry ? commandFiles(entry.command) : [])))],
	};
};
