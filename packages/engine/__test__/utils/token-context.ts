import type { Target } from "@pluginfinity/core";
import type { TokenContext } from "../../src/tokens.js";

/**
 * A token context for the plugin `demo`: skills `alpha` (with
 * `references/guide.md`) and `beta`, agent `reviewer`, and own MCP server
 * `mcp`.
 */
export const tokenContext = (target: Target, overrides: Partial<TokenContext> = {}): TokenContext => ({
	target,
	plugin: "demo",
	skills: new Set(["alpha", "beta"]),
	agents: new Set(["reviewer"]),
	skillFiles: new Set(["alpha/SKILL.md", "alpha/references/guide.md", "beta/SKILL.md"]),
	own: { plugin: "demo", servers: new Set(["mcp"]) },
	...overrides,
});
