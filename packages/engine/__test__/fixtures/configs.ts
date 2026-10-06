// Config file bodies the loader tests write to disk. Kept as strings because
// two of them are deliberately broken TypeScript.

export const VALID = `export default { name: "valid-plugin", description: "Fixture plugin.", claude: { name: "valid-claude" }, copilot: true };\n`;

export const VALID_WITH_IMPORT = `import { shared } from "./shared.js";\nexport default { name: shared, description: "Fixture plugin.", claude: true };\n`;

export const SHARED_MODULE = `export const shared = "shared-name";\n`;

export const SYNTAX_ERROR = `export default { name: "broken", description: "Fixture plugin.", claude: true \n`;

export const UNRESOLVED_IMPORT = `import { missing } from "./does-not-exist.js";\nexport default { name: missing, description: "Fixture plugin.", claude: true };\n`;

export const INVALID_SHAPE = `export default { name: "Not Kebab", description: "Fixture plugin.", claude: false };\n`;

export const UNKNOWN_KEY = `export default { name: "typo", description: "Fixture plugin.", claud: true };\n`;

export const NESTED_UNKNOWN_KEY = `export default { name: "x", description: "Fixture plugin.", claude: { nam: "y" } };\n`;

export const NO_TARGET = `export default { name: "lonely", description: "Fixture plugin." };\n`;

export const NO_DEFAULT = `export const name = "no-default";\n`;

export const ONLY_COPILOT = `export default { name: "only-copilot", description: "Fixture plugin.", copilot: true };\n`;

export const THROWS_ON_LOAD = `throw new Error("config exploded");\nexport default { name: "never", description: "Fixture plugin.", claude: true };\n`;

export const NULL_DEFAULT = `export default null;\n`;

export const FUNCTION_DEFAULT = `export default () => ({ name: "lazy", description: "Fixture plugin.", claude: true });\n`;

export const HANGS_ON_LOAD = `await new Promise(() => {});\nexport default { name: "hangs", description: "Fixture plugin.", claude: true };\n`;

export const PACKAGE_JSON = `{ "name": "fixture-package", "version": "1.2.3" }\n`;

export const HOOKED = `export default {
	name: "hooked",
	description: "Fixture plugin.",
	hooks: { SessionStart: [{ script: "hooks/start.sh", timeout: 5 }] },
	claude: true,
	copilot: { hooks: { SessionStart: [{ script: "hooks/start.copilot.sh" }] } },
};\n`;

export const HOOKED_EXEC = `export default {
	name: "hooked",
	description: "Fixture plugin.",
	scripts: { invoke: "exec" },
	hooks: { SessionStart: [{ script: "hooks/start.sh" }] },
	claude: true,
};\n`;

export const HOOKED_UNSUPPORTED = `export default {
	name: "hooked",
	description: "Fixture plugin.",
	hooks: { Setup: [{ script: "hooks/start.sh" }] },
	copilot: true,
};\n`;

export const HOOKED_COMMAND = `export default {
	name: "hooked",
	description: "Fixture plugin.",
	hooks: { Stop: [{ command: 'bash "\${PLUGIN_ROOT}/scripts/stop.sh" --quiet' }] },
	claude: true,
};\n`;

export const WITH_MCP = `export default {
	name: "with-mcp",
	description: "Fixture plugin.",
	mcpServers: { docs: { type: "http", url: "https://example.com/mcp" } },
	claude: true,
};\n`;

export const WITH_SERVERS = `export default {
	name: "with-servers",
	description: "Fixture plugin.",
	mcpServers: { mcp: { command: "sh", args: ["\${PLUGIN_ROOT}/bin/start-mcp.sh"] } },
	lspServers: { md: { command: "sh", args: ["\${PLUGIN_ROOT}/bin/start-lsp.sh", "--stdio"], extensionToLanguage: { ".md": "markdown" } } },
	files: ["share/"],
	claude: true,
	copilot: true,
};\n`;

export const SERVER_EXEC_COMMAND = `export default {
	name: "exec-command",
	description: "Fixture plugin.",
	mcpServers: { mcp: { command: "\${PLUGIN_ROOT}/bin/serve" } },
	claude: true,
};\n`;

export const SERVER_SHARED_LAUNCHER = `export default {
	name: "shared-launcher",
	description: "Fixture plugin.",
	mcpServers: { mcp: { command: "\${PLUGIN_ROOT}/bin/serve" } },
	lspServers: { md: { command: "sh", args: ["\${PLUGIN_ROOT}/bin/serve"], extensionToLanguage: { ".md": "markdown" } } },
	claude: true,
};\n`;

export const SERVER_ESCAPE = `export default {
	name: "server-escape",
	description: "Fixture plugin.",
	mcpServers: { mcp: { command: "sh", args: ["\${PLUGIN_ROOT}/a/../../escape.sh"] } },
	claude: true,
};\n`;

export const SERVER_DOTTED = `export default {
	name: "server-dotted",
	description: "Fixture plugin.",
	mcpServers: { mcp: { command: "sh", args: ["\${PLUGIN_ROOT}/bin/../bin/./start.sh"] } },
	claude: true,
};\n`;

export const FILES_MISSING = `export default {
	name: "files-missing",
	description: "Fixture plugin.",
	files: ["nope.txt"],
	claude: true,
};\n`;

export const LSP_UNRESOLVED = `export default {
	name: "lsp-unresolved",
	description: "Fixture plugin.",
	lspServers: { md: { command: "sh", extensionToLanguage: { ".md": "markdown" }, settings: { a: 1 } } },
	copilot: true,
};\n`;

export const FILES_RESERVED = `export default {
	name: "files-reserved",
	description: "Fixture plugin.",
	files: ["lib/"],
	claude: true,
};\n`;

export const FILES_COLLIDE = `export default {
	name: "files-collide",
	description: "Fixture plugin.",
	mcpServers: { docs: { type: "http", url: "https://example.com/mcp" } },
	files: [".mcp.json"],
	claude: true,
};\n`;

export const FILES_OVERLAP = `export default {
	name: "files-overlap",
	description: "Fixture plugin.",
	mcpServers: { mcp: { command: "sh", args: ["\${PLUGIN_ROOT}/bin/start-mcp.sh"] } },
	files: ["bin/"],
	claude: true,
};\n`;

export const SERVER_CLIMB_INSIDE = `export default {
	name: "server-climb-inside",
	description: "Fixture plugin.",
	mcpServers: { mcp: { command: "sh", args: ["\${PLUGIN_ROOT}/a/../bin/start.sh"] } },
	claude: true,
};\n`;

export const SERVER_PLAIN = `export default {
	name: "server-plain",
	description: "Fixture plugin.",
	mcpServers: { mcp: { command: "sh", args: ["\${PLUGIN_ROOT}/bin/start.sh"] } },
	claude: true,
};\n`;

export const FILES_SHARE = `export default {
	name: "files-share",
	description: "Fixture plugin.",
	files: ["share/"],
	claude: true,
};\n`;

export const FILES_BUILDS = `export default {
	name: "files-builds",
	description: "Fixture plugin.",
	files: ["builds/"],
	claude: true,
};\n`;

/** A config with one MCP server, `server`, on both targets. */
const serverRefs = (name: string, server: string) => `export default {
	name: "${name}",
	description: "Fixture plugin.",
	mcpServers: { mcp: ${server} },
	claude: true,
	copilot: true,
};\n`;

export const SERVER_DIR_ENV = serverRefs("server-dir-env", `{ command: "sh", env: { DATA: "\${PLUGIN_ROOT}/share" } }`);

export const SERVER_DIR_SLASH = serverRefs("server-dir-slash", `{ command: "sh", env: { DATA: "\${PLUGIN_ROOT}/share/" } }`);

export const SERVER_PATH_ENV = serverRefs(
	"server-path-env",
	`{ command: "sh", env: { PATH: "\${PLUGIN_ROOT}/bin:/usr/bin" } }`,
);

export const SERVER_DIR_COMMAND = serverRefs("server-dir-command", `{ command: "\${PLUGIN_ROOT}/bin" }`);

export const SERVER_FILE_SLASH = serverRefs(
	"server-file-slash",
	`{ command: "sh", args: ["\${PLUGIN_ROOT}/bin/start.sh/"] }`,
);

export const SERVER_HOST_SPELLING = serverRefs(
	"server-host-spelling",
	`{ command: "sh", args: ["\${CLAUDE_PLUGIN_ROOT}/bin/start.sh"] }`,
);

export const NOTED = `export default {
	name: "noted",
	description: "Fixture plugin.",
	hooks: { Setup: [{ script: "hooks/setup.sh", fallback: "omit" }] },
	lspServers: { md: { command: "sh", extensionToLanguage: { ".md": "markdown" }, diagnostics: true } },
	claude: true,
	copilot: true,
};\n`;

/** An agent with fields Copilot drops. */
export const NOTED_AGENT = "---\nname: x\ndescription: Does x.\ncolor: red\nmaxTurns: 3\n---\n\nBody.\n";

/** A skill with a field Copilot degrades and a tool it cannot name. */
export const NOTED_SKILL = "---\nname: s\ndescription: Does s.\npaths: src/**\nallowed-tools: Read ToolSearch\n---\n\nBody.\n";

/** A skill that sets nothing host-specific. */
export const PLAIN_SKILL = "---\nname: plain\ndescription: Does plain.\n---\n\nBody.\n";
