import {
	BASE_CONFIG_KEYS,
	BaseConfigFields,
	CLAUDE_HOOK_EVENTS,
	Hooks,
	makeHooks,
	makeTargetSetting,
} from "@pluginfinity/core";
import { Schema } from "effect";
import { COPILOT_OWN_EVENTS } from "./copilot.js";
import type { KnownTargetId } from "./registry.js";
import { KNOWN_TARGET_IDS } from "./registry.js";

/**
 * The `claude` key's value: hooks overrides use Claude Code events only.
 *
 * @public
 */
export const ClaudeSetting = makeTargetSetting(Hooks);

/**
 * The `copilot` key's value: hooks overrides may also use Copilot's own events.
 *
 * @public
 */
export const CopilotSetting = makeTargetSetting(makeHooks([...CLAUDE_HOOK_EVENTS, ...COPILOT_OWN_EVENTS] as const));

/**
 * The whole `pluginfinity.config.ts` shape: the plugin-wide fields from
 * `@pluginfinity/core` and one optional key per registry target.
 *
 * @remarks
 * The target keys are spelled out rather than mapped from the registry so the
 * editor sees each one by name; a test pins them to `KNOWN_TARGET_IDS`.
 * Decode with `{ onExcessProperty: "error" }` to reject unknown keys.
 *
 * @public
 */
export const PluginfinityConfig = Schema.Struct({
	...BaseConfigFields,
	claude: Schema.optionalKey(ClaudeSetting),
	copilot: Schema.optionalKey(CopilotSetting),
});

/**
 * A decoded pluginfinity config.
 *
 * @public
 */
export type PluginfinityConfig = typeof PluginfinityConfig.Type;

/**
 * What a `pluginfinity.config.ts` default-exports: the encoded config.
 *
 * @public
 */
export type PluginfinityConfigInput = typeof PluginfinityConfig.Encoded;

/**
 * Every top-level key a config may hold: the base fields, then the target ids.
 *
 * @public
 */
export const CONFIG_KEYS: ReadonlyArray<string> = [...BASE_CONFIG_KEYS, ...KNOWN_TARGET_IDS];

/**
 * The targets a config enables, in registry order.
 *
 * @public
 */
export const enabledTargets = (config: PluginfinityConfig): ReadonlyArray<KnownTargetId> =>
	KNOWN_TARGET_IDS.filter((id) => config[id] !== undefined);
