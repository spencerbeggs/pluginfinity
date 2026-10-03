/**
 * pluginfinity: build one agent-plugin source into every host's format.
 *
 * @remarks
 * The one supported library surface is the config: `defineConfig` and its
 * types, for `pluginfinity.config.ts`. Run the `pluginfinity` bin for everything else.
 *
 * @packageDocumentation
 */

import type { PluginfinityConfigInput } from "@pluginfinity/targets";

export type { KnownTargetId, PluginfinityConfig, PluginfinityConfigInput } from "@pluginfinity/targets";

/**
 * Declare a plugin's `pluginfinity.config.ts`, typed against the config schema.
 *
 * @example
 * ```ts
 * import { defineConfig } from "pluginfinity";
 *
 * export default defineConfig({
 * 	name: "foo",
 * 	description: "What foo does",
 * 	claude: { name: "baz" },
 * 	copilot: true,
 * });
 * ```
 *
 * @param config - the plugin's name, description and one key per enabled target
 * @returns `config`, unchanged: pluginfinity decodes it when it loads the file
 *
 * @public
 */
export const defineConfig = (config: PluginfinityConfigInput): PluginfinityConfigInput => config;
