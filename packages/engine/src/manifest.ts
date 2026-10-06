import type { ManifestFormat, Target } from "@pluginfinity/core";
import type { KnownTargetId, PluginfinityConfig } from "@pluginfinity/targets";

/**
 * A manifest as written: a JSON object in the target's key order.
 *
 * @public
 */
export type Manifest = Readonly<Record<string, unknown>>;

/** The name a target publishes under: its override, else the config's. */
export const pluginName = (config: PluginfinityConfig, id: KnownTargetId): string => {
	const setting = config[id];
	return typeof setting === "object" && setting.name !== undefined ? setting.name : config.name;
};

// Each named format turns the shared metadata into that host's record. The
// record is total over MANIFEST_FORMATS, so a new format cannot build until it
// has an entry here.
const FORMATS: Record<typeof ManifestFormat.Type, (target: Target, fields: Manifest) => Manifest> = {
	"claude-plugin-json": (_target, fields) => fields,
	"agent-plugins-1.0": (target, fields) => {
		if (target.manifest.schema === undefined) {
			throw new Error("an agent-plugins-1.0 target must pin its manifest $schema");
		}
		return { $schema: target.manifest.schema, ...fields };
	},
};

/**
 * Render a target's manifest from the config and the package version: the
 * format's record, cut to the target's key allowlist, in allowlist order, with
 * unset keys left out.
 *
 * @public
 */
export const renderManifest = (
	target: Target,
	id: KnownTargetId,
	config: PluginfinityConfig,
	version: string,
): Manifest => {
	const record = FORMATS[target.manifest.format](target, {
		name: pluginName(config, id),
		version,
		description: config.description,
		author: config.author,
		homepage: config.homepage,
		repository: config.repository,
		license: config.license,
		keywords: config.keywords,
	});
	return Object.fromEntries(
		target.manifest.keys.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]),
	);
};

/**
 * The bytes a manifest is written as: tab-indented JSON with a final newline.
 *
 * @public
 */
export const serializeManifest = (manifest: Manifest): string => `${JSON.stringify(manifest, null, "\t")}\n`;
