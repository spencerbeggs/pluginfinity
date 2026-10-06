import type { MonitorEntry, Target } from "@pluginfinity/core";
import type { KnownTargetId, PluginfinityConfig } from "@pluginfinity/targets";
import { TARGETS } from "@pluginfinity/targets";
import { commandFiles, hookCommand } from "./hooks.js";
import type { BuildNote } from "./notes.js";
import { CONFIG_NOTE_PATH } from "./notes.js";

type MonitorMap = Readonly<Record<string, MonitorEntry>>;

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

/** What a target builds of its monitors, before the build checks and ships the files. */
export interface RenderedMonitors {
	/** The monitors file, or none when the target has no monitors or the plugin sets none. */
	readonly file?: { readonly path: string; readonly content: string };
	readonly notes: ReadonlyArray<BuildNote>;
	/** Every `script` the monitors run, plugin-relative. */
	readonly scripts: ReadonlyArray<string>;
	/** Every file a `command` monitor names as `${PLUGIN_ROOT}/<path>`. */
	readonly commandFiles: ReadonlyArray<string>;
}

const idOf = (target: Target): KnownTargetId => {
	const entry = TARGETS.find((candidate) => candidate.target === target);
	if (entry === undefined) throw new Error("target is not in the registry");
	return entry.id;
};

/**
 * Render a target's monitors file. A target with no monitors drops every
 * monitor with a `monitor-omitted` note and ships neither file nor script.
 *
 * @remarks
 * Each entry's command exports `PLUGINFINITY_MONITOR` (the monitor's name,
 * which the monitor library logs under), in the one shape the hook command
 * builder writes: a prefix on a script, an `export` before a command.
 *
 * @public
 */
export const renderMonitors = (target: Target, monitors: MonitorMap, invoke: "bash" | "exec"): RenderedMonitors => {
	const entries = Object.entries(monitors);
	if (entries.length === 0) return { notes: [], scripts: [], commandFiles: [] };
	const placement = target.monitors;
	if (!("path" in placement)) {
		const id = idOf(target);
		return {
			notes: entries.map(([name]) => ({ target: id, path: CONFIG_NOTE_PATH, kind: "monitor-omitted", name })),
			scripts: [],
			commandFiles: [],
		};
	}
	const array = entries.map(([name, entry]) => {
		const env = { PLUGINFINITY_MONITOR: name };
		const command = hookCommand(entry, placement.root, invoke, env);
		return {
			name,
			// A script entry carries the variable as a prefix: `K='V' bash "<path>"`.
			command: "script" in entry ? `PLUGINFINITY_MONITOR='${name}' ${command}` : command,
			description: entry.description,
			...(entry.when === undefined ? {} : { when: entry.when }),
		};
	});
	return {
		file: { path: placement.path, content: `${JSON.stringify(array, null, "\t")}\n` },
		notes: [],
		scripts: [...new Set(entries.flatMap(([, entry]) => ("script" in entry ? [entry.script] : [])))],
		commandFiles: [...new Set(entries.flatMap(([, entry]) => ("command" in entry ? commandFiles(entry.command) : [])))],
	};
};
