import { assert, describe, it } from "@effect/vitest";
import { CLAUDE, COPILOT } from "@pluginfinity/targets";
import { renderToolMap } from "../src/tool-map.js";

const NONE = { skills: [], agents: [], monitors: [] };

describe("renderToolMap", () => {
	it("lists the components built for this target, space separated", () => {
		const text = renderToolMap(CLAUDE, "silk", ["savvy-mcp", "other"], {
			skills: ["build", "commit-create"],
			agents: ["reviewer"],
			monitors: ["watch"],
		});
		assert.include(text, `_PF_HAS_SKILLS='build commit-create'`);
		assert.include(text, `_PF_HAS_AGENTS='reviewer'`);
		assert.include(text, `_PF_HAS_MONITORS='watch'`);
		assert.include(text, `_PF_HAS_SERVERS='savvy-mcp other'`);
	});
	it("an excluded skill is absent from that target's list", () => {
		const claude = renderToolMap(CLAUDE, "silk", [], { skills: ["a", "b"], agents: [], monitors: [] });
		const copilot = renderToolMap(COPILOT, "silk", [], { skills: ["a"], agents: [], monitors: [] });
		assert.include(claude, `_PF_HAS_SKILLS='a b'`);
		assert.include(copilot, `_PF_HAS_SKILLS='a'`);
		assert.notInclude(copilot, "b'");
	});
	it("a target without monitors lists none", () => {
		assert.include(
			renderToolMap(COPILOT, "silk", [], { skills: [], agents: [], monitors: ["watch"] }),
			`_PF_HAS_MONITORS=''`,
		);
	});
	it("Copilot's map spells built-ins and own MCP tools and omits unresolved names", () => {
		const text = renderToolMap(COPILOT, "silk", ["savvy-mcp"], NONE);
		assert.include(text, "Read=view");
		assert.notInclude(text, "TodoWrite=");
		assert.include(text, `_PF_TOOLS_MCP='{server}-{tool}'`);
		assert.include(text, `_PF_TOOLS_SERVERS='savvy-mcp'`);
		assert.include(text, `_PF_TOOLS_PLUGIN='silk'`);
		assert.include(text, `_PF_TOOLS_UNLISTED=unresolved`);
	});
	it("Claude's map keeps unlisted names", () => {
		assert.include(renderToolMap(CLAUDE, "silk", [], NONE), "_PF_TOOLS_UNLISTED=keep");
	});
});
