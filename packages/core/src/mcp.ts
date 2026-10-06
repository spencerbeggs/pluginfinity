import { Schema } from "effect";

/**
 * A server's environment. `PLUGINFINITY_` keys are reserved for the
 * variables the build injects.
 *
 * @public
 */
export const ServerEnv = Schema.Record(
	Schema.String.check(
		Schema.isPattern(/^(?!PLUGINFINITY_)/, { message: "PLUGINFINITY_ env keys are reserved for the build" }),
	),
	Schema.String,
);

/**
 * A local MCP server the host launches. `${PLUGIN_ROOT}` is the one
 * placeholder in `args`, `env` and `cwd`.
 *
 * @public
 */
export const StdioMcpServer = Schema.Struct({
	type: Schema.optionalKey(Schema.Literal("stdio")),
	command: Schema.String.check(Schema.isMinLength(1)),
	args: Schema.optionalKey(Schema.Array(Schema.String)),
	env: Schema.optionalKey(ServerEnv),
	cwd: Schema.optionalKey(Schema.String),
});

/**
 * A remote MCP server the host connects to.
 *
 * @public
 */
export const RemoteMcpServer = Schema.Struct({
	type: Schema.Literals(["http", "sse"]),
	url: Schema.String.check(Schema.isPattern(/^https?:\/\//, { message: "must be an http or https URL" })),
	headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});

/**
 * One MCP server, in Claude Code's `.mcp.json` server shape.
 *
 * @public
 */
export const McpServer = Schema.Union([StdioMcpServer, RemoteMcpServer]);

/**
 * A plugin's MCP servers, keyed by server name.
 *
 * @public
 */
export const McpServers = Schema.Record(Schema.String, McpServer);
