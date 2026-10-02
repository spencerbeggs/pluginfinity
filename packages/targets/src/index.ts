/**
 * The host targets pluginfinity builds for, described as data.
 *
 * @remarks
 * The registry (`claude`, `copilot`) and the assembled `PluginfinityConfig`
 * schema, which joins the `@pluginfinity/core` base fields with one optional key
 * per target. Capability descriptions land once `@pluginfinity/core` defines the
 * `Target` schema.
 *
 * @packageDocumentation
 */

export { CLAUDE } from "./claude.js";
export type { PluginfinityConfigInput } from "./config.js";
export { CONFIG_KEYS, PluginfinityConfig, enabledTargets } from "./config.js";
export { COPILOT, COPILOT_OWN_EVENTS } from "./copilot.js";
export type { TargetEntry } from "./registry.js";
export { KNOWN_TARGET_IDS, KnownTargetId, TARGETS, isKnownTargetId } from "./registry.js";
export { TARGETS_VERSION } from "./version.js";
