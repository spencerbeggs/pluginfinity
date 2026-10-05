import type { FieldMapEntry, Target } from "@pluginfinity/core";
import type { KnownTargetId, PluginfinityConfig } from "@pluginfinity/targets";
import type { EmittedFile } from "./emit.js";
import { ConfigIssue } from "./errors.js";

type Server = Readonly<Record<string, unknown>>;
type Servers = Readonly<Record<string, Server>>;
type Env = Readonly<Record<string, string>>;

/**
 * A target's server config files, the problems that stop it building them,
 * and whether any server is a local process that needs the server library.
 *
 * @public
 */
export interface ServerRender {
	readonly files: ReadonlyArray<EmittedFile>;
	readonly issues: ReadonlyArray<ConfigIssue>;
	readonly stdio: boolean;
}

const PLACEHOLDER = `\${PLUGIN_ROOT}`;
// A path after the root placeholder, up to a character that ends a shell word or a quoted string.
const ROOT_FILE = /\$\{PLUGIN_ROOT\}\/([^\s"'`;|&<>()$]+)/g;

const merged = (id: KnownTargetId, config: PluginfinityConfig, key: "mcpServers" | "lspServers"): Servers => {
	const setting = config[id];
	return { ...(config[key] ?? {}), ...(typeof setting === "object" ? (setting[key] ?? {}) : {}) } as Servers;
};

const isStdio = (server: Server): boolean => server.type === undefined || server.type === "stdio";

// Every string in a JSON value, rewritten.
const rewrite = (value: unknown, root: string): unknown => {
	if (typeof value === "string") return value.replaceAll(PLACEHOLDER, root);
	if (Array.isArray(value)) return value.map((item) => rewrite(item, root));
	if (typeof value === "object" && value !== null)
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v, root)]));
	return value;
};

// The fields a `${PLUGIN_ROOT}` placeholder is documented in; every other field passes through untouched.
const MCP_ROOT_FIELDS = ["command", "args", "env", "cwd"] as const;
const LSP_ROOT_FIELDS = ["command", "args", "env", "workspaceFolder"] as const;

// The server restricted to the given fields.
const only = (server: Server, fields: ReadonlyArray<string>): Server =>
	Object.fromEntries(Object.entries(server).filter(([field]) => fields.includes(field)));

// The server with the root rewritten in the given fields only.
const rewriteFields = (server: Server, fields: ReadonlyArray<string>, root: string): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(server).map(([field, value]) => [field, fields.includes(field) ? rewrite(value, root) : value]),
	);

const serialize = (value: unknown): string => `${JSON.stringify(value, null, "\t")}\n`;

const injectedEnv = (id: KnownTargetId, plugin: string, root: string, libDir: string): Env => ({
	PLUGINFINITY_HOST: id,
	PLUGINFINITY_PLUGIN: plugin,
	PLUGINFINITY_LIB: `${root}/${libDir}`,
});

const withEnv = (server: Record<string, unknown>, env: Env): Record<string, unknown> => ({
	...server,
	env: { ...((server.env as Env | undefined) ?? {}), ...env },
});

const rootOf = (spelling: Target["pluginRoot"]["mcp"], key: string, issues: Array<ConfigIssue>): string | undefined => {
	if (typeof spelling === "string") return spelling;
	issues.push(ConfigIssue.make({ key, message: spelling.note }));
	return undefined;
};

// Apply one LSP field map entry. Server fields take keep, rename, drop and unresolved only.
const mapField = (
	entry: FieldMapEntry | undefined,
	field: string,
	value: unknown,
	out: Record<string, unknown>,
	key: string,
	issues: Array<ConfigIssue>,
): void => {
	switch (entry?._tag) {
		case "keep":
			out[field] = value;
			return;
		case "rename":
			out[entry.to] = value;
			return;
		case "drop":
			return;
		case "unresolved":
			issues.push(ConfigIssue.make({ key, message: entry.note }));
			return;
		default:
			issues.push(ConfigIssue.make({ key, message: `no server rule for field ${field}` }));
	}
};

interface McpInput {
	readonly target: Target;
	readonly servers: Servers;
	readonly env: Env;
	readonly root: string;
	readonly issues: Array<ConfigIssue>;
}

const mcpEntries = ({ servers, env, root, issues }: McpInput, copilot: boolean): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const [name, server] of Object.entries(servers)) {
		if (!isStdio(server)) {
			// A remote server names no plugin file, so its root is never rewritten.
			out[name] = copilot && server.type === "http" ? { ...server, type: "streamable-http" } : { ...server };
			continue;
		}
		const rewritten = rewriteFields(server, MCP_ROOT_FIELDS, root);
		if (!copilot && "cwd" in rewritten) {
			issues.push(
				ConfigIssue.make({
					key: `mcpServers.${name}.cwd`,
					message:
						"Claude Code ignores an MCP server's cwd (it runs in the project directory); set cwd under copilot.mcpServers or cd in the launcher instead",
				}),
			);
			delete rewritten.cwd;
		}
		// Copilot silently drops an entry with no transport type, so name it.
		out[name] = copilot ? { type: "stdio", ...withEnv(rewritten, env) } : withEnv(rewritten, env);
	}
	return out;
};

// One encoder per MCP format, total over MCP_FORMATS.
const MCP_ENCODERS: Record<Target["mcp"]["format"], (input: McpInput) => unknown> = {
	"claude-mcp-json": (input) => ({ mcpServers: mcpEntries(input, false) }),
	"agent-plugins-mcp-1.0": (input) => ({
		...(input.target.mcp.schema === undefined ? {} : { $schema: input.target.mcp.schema }),
		mcpServers: mcpEntries(input, true),
	}),
};

interface LspInput {
	readonly target: Target;
	readonly servers: Servers;
	readonly env: Env;
	readonly root: string;
	readonly issues: Array<ConfigIssue>;
}

const lspEntries = ({ target, servers, env, root, issues }: LspInput): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const [name, server] of Object.entries(servers)) {
		const entry: Record<string, unknown> = {};
		for (const [field, value] of Object.entries(rewriteFields(server, LSP_ROOT_FIELDS, root))) {
			mapField(target.lsp.fields[field], field, value, entry, `lspServers.${name}.${field}`, issues);
		}
		out[name] = withEnv(entry, env);
	}
	return out;
};

// One encoder per LSP format, total over LSP_FORMATS.
const LSP_ENCODERS: Record<Target["lsp"]["format"], (input: LspInput) => unknown> = {
	"claude-lsp-json": (input) => lspEntries(input),
	"copilot-lsp-json": (input) => ({ lspServers: lspEntries(input) }),
};

/**
 * The target's MCP and LSP config files: base servers with the target's
 * overrides applied by name, `${PLUGIN_ROOT}` rewritten to the target's
 * spelling, LSP fields mapped through the target's field map, and the
 * server-library variables added to every local server's `env`.
 *
 * @public
 */
export const renderServers = (
	target: Target,
	id: KnownTargetId,
	config: PluginfinityConfig,
	plugin: string,
	libDir: string,
): ServerRender => {
	const issues: Array<ConfigIssue> = [];
	const files: Array<EmittedFile> = [];
	const mcp = merged(id, config, "mcpServers");
	const lsp = merged(id, config, "lspServers");
	if (Object.keys(mcp).length > 0) {
		const root = rootOf(target.pluginRoot.mcp, "mcpServers", issues);
		if (root !== undefined) {
			const env = injectedEnv(id, plugin, root, libDir);
			files.push({
				path: target.mcp.path,
				content: serialize(MCP_ENCODERS[target.mcp.format]({ target, servers: mcp, env, root, issues })),
			});
		}
	}
	if (Object.keys(lsp).length > 0) {
		const root = rootOf(target.pluginRoot.lsp, "lspServers", issues);
		if (root !== undefined) {
			const env = injectedEnv(id, plugin, root, libDir);
			files.push({
				path: target.lsp.path,
				content: serialize(LSP_ENCODERS[target.lsp.format]({ target, servers: lsp, env, root, issues })),
			});
		}
	}
	const stdio = Object.values(mcp).some(isStdio) || Object.keys(lsp).length > 0;
	return { files, issues, stdio };
};

const filesIn = (value: unknown): Array<string> => {
	if (typeof value === "string") return [...value.matchAll(ROOT_FILE)].map((match) => match[1] ?? "");
	if (Array.isArray(value)) return value.flatMap(filesIn);
	if (typeof value === "object" && value !== null) return Object.values(value).flatMap(filesIn);
	return [];
};

/**
 * The plugin files a target's servers name after `${PLUGIN_ROOT}/`.
 *
 * @public
 */
export interface ServerFiles {
	/** Paths a whole `command` names; they must be executable. */
	readonly commands: ReadonlyArray<string>;
	/** Every other path a server names. */
	readonly others: ReadonlyArray<string>;
	/** Each path's first naming server, as `mcpServers.<name>` or `lspServers.<name>`. */
	readonly owners: ReadonlyMap<string, string>;
}

/**
 * The plugin files a target's servers name after `${PLUGIN_ROOT}/`: those a
 * whole `command` names, which must be executable, and every other one.
 * Only the fields the root placeholder is documented in are scanned.
 *
 * @public
 */
export const serverFiles = (target: Target, id: KnownTargetId, config: PluginfinityConfig): ServerFiles => {
	// Only the fields a placeholder is documented in count: no remote MCP server, no LSP field the target leaves
	// unresolved (the build already fails those), and no initializationOptions or settings.
	const mcp = Object.entries(merged(id, config, "mcpServers")).flatMap(([name, server]) =>
		isStdio(server) ? [[`mcpServers.${name}`, only(server, MCP_ROOT_FIELDS)] as const] : [],
	);
	const lsp = Object.entries(merged(id, config, "lspServers")).map(
		([name, server]) =>
			[
				`lspServers.${name}`,
				only(
					server,
					LSP_ROOT_FIELDS.filter((field) => target.lsp.fields[field]?._tag !== "unresolved"),
				),
			] as const,
	);
	const servers = [...mcp, ...lsp];
	const commands = new Set<string>();
	const others = new Set<string>();
	const owners = new Map<string, string>();
	for (const [owner, server] of servers) {
		const command = typeof server.command === "string" ? server.command : "";
		const whole =
			command.startsWith(`${PLACEHOLDER}/`) && filesIn(command)[0] === command.slice(PLACEHOLDER.length + 1);
		if (whole) commands.add(command.slice(PLACEHOLDER.length + 1));
		for (const file of filesIn({ ...server, command: whole ? "" : command })) others.add(file);
		for (const file of filesIn(server)) if (!owners.has(file)) owners.set(file, owner);
	}
	return { commands: [...commands], others: [...others].filter((file) => !commands.has(file)), owners };
};
