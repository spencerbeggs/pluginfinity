/**
 * The platform-free pluginfinity domain model.
 *
 * @remarks
 * Holds the plugin-wide config fields and the per-target override shape.
 * The plugin source model and the `Target` capability schema land here in
 * the design phase.
 *
 * @packageDocumentation
 */

export { BASE_CONFIG_KEYS, BaseConfigFields, PluginName, TargetOverride, TargetSetting } from "./config.js";
export { CORE_VERSION } from "./version.js";
