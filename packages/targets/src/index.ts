/**
 * The host targets pluginfinity builds for, described as data.
 *
 * @remarks
 * The registry (`claude`, `copilot`), the `CLAUDE` and `COPILOT` descriptions
 * (values of `@pluginfinity/core`'s `Target` class), and the assembled
 * `PluginfinityConfig` schema, which joins the `@pluginfinity/core` base fields
 * with one optional key per target and its per-target settings.
 *
 * @packageDocumentation
 */

export { CLAUDE } from "./claude.js";
export type { PluginfinityConfigInput } from "./config.js";
export { CONFIG_KEYS, ClaudeSetting, CopilotSetting, PluginfinityConfig, enabledTargets } from "./config.js";
export { COPILOT, COPILOT_OWN_EVENTS } from "./copilot.js";
export type { TargetEntry } from "./registry.js";
export { KNOWN_TARGET_IDS, KnownTargetId, TARGETS, isKnownTargetId } from "./registry.js";
export { TARGETS_VERSION } from "./version.js";
