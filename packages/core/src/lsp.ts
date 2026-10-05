import { Schema } from "effect";
import { ServerEnv } from "./mcp.js";

const NonNegativeInt = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

/**
 * One LSP server, in Claude Code's `.lsp.json` server shape. `${PLUGIN_ROOT}`
 * is the one placeholder in `command`, `args`, `env` and `workspaceFolder`.
 *
 * @public
 */
export const LspServer = Schema.Struct({
	command: Schema.String.check(Schema.isMinLength(1)),
	args: Schema.optionalKey(Schema.Array(Schema.String)),
	env: Schema.optionalKey(ServerEnv),
	extensionToLanguage: Schema.Record(
		Schema.String.check(Schema.isPattern(/^\.[^./]+/, { message: "must start with a dot, like .ts" })),
		Schema.String.check(Schema.isMinLength(1)),
	),
	initializationOptions: Schema.optionalKey(Schema.Unknown),
	settings: Schema.optionalKey(Schema.Unknown),
	workspaceFolder: Schema.optionalKey(Schema.String),
	startupTimeout: Schema.optionalKey(NonNegativeInt),
	shutdownTimeout: Schema.optionalKey(NonNegativeInt),
	restartOnCrash: Schema.optionalKey(Schema.Boolean),
	maxRestarts: Schema.optionalKey(NonNegativeInt),
	diagnostics: Schema.optionalKey(Schema.Boolean),
});

/**
 * A plugin's LSP servers, keyed by server name.
 *
 * @public
 */
export const LspServers = Schema.Record(Schema.String, LspServer);

/**
 * Every LSP server field, so each target's LSP field map can be checked for totality.
 *
 * @public
 */
export const LSP_FIELDS = [
	"command",
	"args",
	"env",
	"extensionToLanguage",
	"initializationOptions",
	"settings",
	"workspaceFolder",
	"startupTimeout",
	"shutdownTimeout",
	"restartOnCrash",
	"maxRestarts",
	"diagnostics",
] as const satisfies ReadonlyArray<keyof typeof LspServer.Type>;

/**
 * One field name of an LSP server.
 *
 * @public
 */
export type LspField = (typeof LSP_FIELDS)[number];
