import type { FieldMapEntry, ServerPlacement, Target } from "@pluginfinity/core";
import type { KnownTargetId, PluginfinityConfig } from "@pluginfinity/targets";
import type { EmittedFile } from "./emit.js";
import { ConfigIssue } from "./errors.js";
import type { BuildNote } from "./notes.js";
import { CONFIG_NOTE_PATH } from "./notes.js";

type Server = Readonly<Record<string, unknown>>;
type Servers = Readonly<Record<string, Server>>;
/** A server by name, with the config key it came from: `mcpServers` or `<target>.mcpServers`. */
type Origins = ReadonlyArray<readonly [name: string, origin: string, server: Server]>;
type Env = Readonly<Record<string, string>>;

/**
 * A target's server config files, the server maps it writes inline in its
 * manifest, the problems that stop it building them, whether any server is a
 * local process that needs the server library, and the server fields the
 * target dropped.
 *
 * @public
 */
export interface ServerRender {
	/** The server files of a target that places its servers in files. */
	readonly files: ReadonlyArray<EmittedFile>;
	/** The server maps of a target that places its servers in its manifest, by manifest key. */
	readonly manifest: Readonly<Record<string, unknown>>;
	readonly issues: ReadonlyArray<ConfigIssue>;
	readonly stdio: boolean;
	/** Each LSP field dropped, as a `config` note named `<origin>.<server>.<field>`, in the order met. */
	readonly notes: ReadonlyArray<BuildNote>;
}

const PLACEHOLDER = `\${PLUGIN_ROOT}`;
// A path after the root placeholder, up to a character that ends a shell word, a quoted string, or an item in
// a PATH-style (`:`) or comma-separated list.
const ROOT_FILE = /\$\{PLUGIN_ROOT\}\/([^\s"'`;|&<>()$:,]+)/g;
// A host's own root spelling, or the portable name without braces; the build rewrites only `${PLUGIN_ROOT}`.
const HOST_ROOT = /\$\{(?:CLAUDE|COPILOT)_PLUGIN_ROOT\}|\$(?:CLAUDE_|COPILOT_)?PLUGIN_ROOT(?![A-Za-z0-9_])/;

// The base servers with the target's overrides applied by name, each with the key it came from.
const merged = (id: KnownTargetId, config: PluginfinityConfig, key: "mcpServers" | "lspServers"): Origins => {
	const setting = config[id];
	const base = (config[key] ?? {}) as Servers;
	const own = (typeof setting === "object" ? (setting[key] ?? {}) : {}) as Servers;
	const out = new Map<string, readonly [string, string, Server]>();
	for (const [name, server] of Object.entries(base)) out.set(name, [name, key, server]);
	for (const [name, server] of Object.entries(own)) out.set(name, [name, `${id}.${key}`, server]);
	return [...out.values()];
};

/**
 * The names of every MCP server the target builds: the base servers and the
 * target's own.
 */
export const mcpServerNames = (id: KnownTargetId, config: PluginfinityConfig): ReadonlySet<string> =>
	new Set(merged(id, config, "mcpServers").map(([name]) => name));

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

// Every string in a JSON value.
const strings = (value: unknown): Array<string> => {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap(strings);
	if (typeof value === "object" && value !== null) return Object.values(value).flatMap(strings);
	return [];
};

// An issue for each root field that spells the root the host's way, which the build would pass through unrewritten.
const hostSpellings = (
	server: Server,
	fields: ReadonlyArray<string>,
	key: string,
	issues: Array<ConfigIssue>,
): void => {
	for (const field of fields) {
		const spelled = strings(server[field])
			.find((value) => HOST_ROOT.test(value))
			?.match(HOST_ROOT)?.[0];
		if (spelled === undefined) continue;
		issues.push(
			ConfigIssue.make({
				key: `${key}.${field}`,
				message: `${spelled} is one host's spelling of the plugin root; write \${PLUGIN_ROOT} and the build rewrites it for each target`,
			}),
		);
	}
};

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

// Apply one LSP field map entry, recording a dropped field's key. Server fields take keep, rename, drop and
// unresolved only.
const mapField = (
	entry: FieldMapEntry | undefined,
	field: string,
	value: unknown,
	out: Record<string, unknown>,
	key: string,
	issues: Array<ConfigIssue>,
	dropped: Array<string>,
): void => {
	switch (entry?._tag) {
		case "keep":
			out[field] = value;
			return;
		case "rename":
			out[entry.to] = value;
			return;
		case "drop":
			dropped.push(key);
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
	readonly servers: Origins;
	readonly env: Env;
	readonly root: string;
	readonly issues: Array<ConfigIssue>;
}

const mcpEntries = ({ servers, env, root, issues }: McpInput, copilot: boolean): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const [name, origin, server] of servers) {
		if (!isStdio(server)) {
			// A remote server names no plugin file, so its root is never rewritten.
			out[name] = copilot && server.type === "http" ? { ...server, type: "streamable-http" } : { ...server };
			continue;
		}
		hostSpellings(server, MCP_ROOT_FIELDS, `${origin}.${name}`, issues);
		const rewritten = rewriteFields(server, MCP_ROOT_FIELDS, root);
		if (!copilot && "cwd" in rewritten) {
			issues.push(
				ConfigIssue.make({
					key: `${origin}.${name}.cwd`,
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
	"claude-mcp-servers": (input) => mcpEntries(input, false),
	"agent-plugins-mcp-1.0": (input) => ({
		...(input.target.mcp.schema === undefined ? {} : { $schema: input.target.mcp.schema }),
		mcpServers: mcpEntries(input, true),
	}),
};

interface LspInput {
	readonly target: Target;
	readonly servers: Origins;
	readonly env: Env;
	readonly root: string;
	readonly issues: Array<ConfigIssue>;
	/** Receives the key of each field the target drops. */
	readonly dropped: Array<string>;
}

const lspEntries = ({ target, servers, env, root, issues, dropped }: LspInput): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const [name, origin, server] of servers) {
		const entry: Record<string, unknown> = {};
		hostSpellings(server, LSP_ROOT_FIELDS, `${origin}.${name}`, issues);
		for (const [field, value] of Object.entries(rewriteFields(server, LSP_ROOT_FIELDS, root))) {
			mapField(target.lsp.fields[field], field, value, entry, `${origin}.${name}.${field}`, issues, dropped);
		}
		out[name] = withEnv(entry, env);
	}
	return out;
};

// One encoder per LSP format, total over LSP_FORMATS.
const LSP_ENCODERS: Record<Target["lsp"]["format"], (input: LspInput) => unknown> = {
	"claude-lsp-servers": (input) => lspEntries(input),
	"copilot-lsp-json": (input) => ({ lspServers: lspEntries(input) }),
};

// Put an encoded server config where the target places it: a file of its own, or a manifest key.
const place = (
	placement: ServerPlacement,
	value: unknown,
	files: Array<EmittedFile>,
	manifest: Record<string, unknown>,
): void => {
	if (placement._tag === "file") files.push({ path: placement.path, content: serialize(value) });
	else manifest[placement.key] = value;
};

/**
 * The target's MCP and LSP configs: base servers with the target's
 * overrides applied by name, `${PLUGIN_ROOT}` rewritten to the target's
 * spelling, LSP fields mapped through the target's field map, and the
 * server-library variables added to every local server's `env`. Each config
 * goes where the target places it: a file of its own, or inline under a
 * manifest key, for `renderManifest` to write.
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
	const dropped: Array<string> = [];
	const files: Array<EmittedFile> = [];
	const manifest: Record<string, unknown> = {};
	const mcp = merged(id, config, "mcpServers");
	const lsp = merged(id, config, "lspServers");
	if (mcp.length > 0) {
		const root = rootOf(target.pluginRoot.mcp, "mcpServers", issues);
		if (root !== undefined) {
			const env = injectedEnv(id, plugin, root, libDir);
			const value = MCP_ENCODERS[target.mcp.format]({ target, servers: mcp, env, root, issues });
			place(target.mcp.placement, value, files, manifest);
		}
	}
	if (lsp.length > 0) {
		const root = rootOf(target.pluginRoot.lsp, "lspServers", issues);
		if (root !== undefined) {
			const env = injectedEnv(id, plugin, root, libDir);
			const value = LSP_ENCODERS[target.lsp.format]({ target, servers: lsp, env, root, issues, dropped });
			place(target.lsp.placement, value, files, manifest);
		}
	}
	const stdio = mcp.some(([, , server]) => isStdio(server)) || lsp.length > 0;
	const notes = dropped.map((name) => ({ target: id, path: CONFIG_NOTE_PATH, kind: "dropped" as const, name }));
	return { files, manifest, issues, stdio, notes };
};

const filesIn = (value: unknown): Array<string> =>
	strings(value).flatMap((text) => [...text.matchAll(ROOT_FILE)].map((match) => match[1] ?? ""));

/**
 * The plugin files a target's servers name after `${PLUGIN_ROOT}/`.
 *
 * @public
 */
export interface ServerFiles {
	/** Paths a whole `command` names; they must be executable. */
	readonly commands: ReadonlyArray<string>;
	/** Every other path a server names: a file, or a directory whose files all ship. */
	readonly others: ReadonlyArray<string>;
	/**
	 * Each path's first naming server, as `mcpServers.<name>` or `lspServers.<name>`,
	 * prefixed with the target for a server a target override sets, as `copilot.mcpServers.<name>`.
	 */
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
	const mcp = merged(id, config, "mcpServers").flatMap(([name, origin, server]) =>
		isStdio(server) ? [[`${origin}.${name}`, only(server, MCP_ROOT_FIELDS)] as const] : [],
	);
	const lsp = merged(id, config, "lspServers").map(
		([name, origin, server]) =>
			[
				`${origin}.${name}`,
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
