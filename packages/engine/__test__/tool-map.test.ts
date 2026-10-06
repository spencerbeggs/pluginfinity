import { assert, describe, it } from "@effect/vitest";
import { CLAUDE, COPILOT } from "@pluginfinity/targets";
import { renderToolMap } from "../src/tool-map.js";

describe("renderToolMap", () => {
	it("Copilot's map spells built-ins and own MCP tools and omits unresolved names", () => {
		const text = renderToolMap(COPILOT, "silk", ["savvy-mcp"]);
		assert.include(text, "Read=view");
		assert.notInclude(text, "TodoWrite=");
		assert.include(text, `_PF_TOOLS_MCP='{server}-{tool}'`);
		assert.include(text, `_PF_TOOLS_SERVERS='savvy-mcp'`);
		assert.include(text, `_PF_TOOLS_PLUGIN='silk'`);
		assert.include(text, `_PF_TOOLS_UNLISTED=unresolved`);
	});
	it("Claude's map keeps unlisted names", () => {
		assert.include(renderToolMap(CLAUDE, "silk", []), "_PF_TOOLS_UNLISTED=keep");
	});
});
