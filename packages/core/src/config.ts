import { Schema } from "effect";

/**
 * A plugin name as every host spells it: kebab-case, lowercase letters and
 * digits separated by single hyphens.
 *
 * @public
 */
export const PluginName = Schema.String.check(
	Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
		message: "must be kebab-case: lowercase letters and digits separated by single hyphens",
	}),
);

/**
 * The plugin-wide fields of a pluginfinity config, before any target key.
 *
 * @remarks
 * `@pluginfinity/targets` spreads these into the assembled `PluginfinityConfig`
 * beside one key per target. Base keys and target ids share one key space,
 * so a base key must never equal a target id.
 *
 * @public
 */
export const BaseConfigFields = {
	/** The plugin's name for every host. Not read from `package.json`. */
	name: PluginName,
} as const;

/**
 * The names of the plugin-wide config fields.
 *
 * @public
 */
export const BASE_CONFIG_KEYS: ReadonlyArray<string> = Object.keys(BaseConfigFields);

/**
 * What a target key may override for that host.
 *
 * @public
 */
export const TargetOverride = Schema.Struct({
	/** The plugin's name on this host, when it differs from the base `name`. */
	name: Schema.optionalKey(PluginName),
});

/**
 * The decoded `TargetOverride`.
 *
 * @public
 */
export type TargetOverride = typeof TargetOverride.Type;

/**
 * A target key's value: `true` to enable the target with no overrides, or an
 * override object. An absent key means the target is off; `false` is rejected.
 *
 * @public
 */
export const TargetSetting = Schema.Union([Schema.Literal(true), TargetOverride]);

/**
 * The decoded `TargetSetting`.
 *
 * @public
 */
export type TargetSetting = typeof TargetSetting.Type;
