import { Schema } from "effect";
import { Hooks } from "./hooks.js";
import { McpServers } from "./mcp.js";

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
 * How a `script` hook is invoked: through `bash`, which ignores the file
 * mode, or directly, which needs the executable bit.
 *
 * @public
 */
export const ScriptInvoke = Schema.Literals(["bash", "exec"]);

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
	/** What the plugin does, shown by every host. */
	description: Schema.String.check(Schema.isMinLength(1)),
	author: Schema.optionalKey(
		Schema.Struct({
			name: Schema.String,
			email: Schema.optionalKey(Schema.String),
			url: Schema.optionalKey(Schema.String),
		}),
	),
	homepage: Schema.optionalKey(Schema.String),
	repository: Schema.optionalKey(Schema.String),
	license: Schema.optionalKey(Schema.String),
	keywords: Schema.optionalKey(Schema.Array(Schema.String)),
	/** How `script` hooks are invoked. Defaults to `{ invoke: "bash" }`. */
	scripts: Schema.optionalKey(Schema.Struct({ invoke: Schema.optionalKey(ScriptInvoke) })),
	/** Hooks keyed by Claude Code event names, generated per target. */
	hooks: Schema.optionalKey(Hooks),
	/** MCP servers in Claude Code's `.mcp.json` server shape. */
	mcpServers: Schema.optionalKey(McpServers),
} as const;

/**
 * The names of the plugin-wide config fields.
 *
 * @public
 */
export const BASE_CONFIG_KEYS: ReadonlyArray<string> = Object.keys(BaseConfigFields);

/**
 * A target key's value: `true` to enable the target with no overrides, or an
 * override object. An absent key means the target is off; `false` is rejected.
 *
 * @remarks
 * `hooks` is the target's own hooks schema, so each target admits the events
 * it has: a hook under it replaces the base entries for that event on that
 * target, and `[]` removes them. A server under `mcpServers` replaces the base
 * server of that name.
 *
 * @public
 */
export const makeTargetSetting = <H extends Schema.Top>(hooks: H) =>
	Schema.Union([
		Schema.Literal(true),
		Schema.Struct({
			/** The plugin's name on this host, when it differs from the base `name`. */
			name: Schema.optionalKey(PluginName),
			hooks: Schema.optionalKey(hooks),
			mcpServers: Schema.optionalKey(McpServers),
		}),
	]);
