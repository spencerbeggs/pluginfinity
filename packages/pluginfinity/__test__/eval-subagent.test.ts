import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";

const BUILDS = fileURLToPath(new URL("../../../plugins/dogfood/builds/", import.meta.url));
// Where each host's build puts plugin agents.
const AGENT_FILE = {
	claude: `${BUILDS}claude/agents/eval-subagent.md`,
	copilot: `${BUILDS}copilot/com.github.copilot/agents/eval-subagent.agent.md`,
} as const;

describe("eval-subagent builds", () => {
	for (const host of ["claude", "copilot"] as const) {
		it(`builds to ${host}, neutral: no skills preloaded or listed`, () => {
			assert.isTrue(existsSync(AGENT_FILE[host]), AGENT_FILE[host]);
			const text = readFileSync(AGENT_FILE[host], "utf8");
			assert.include(text, "name: eval-subagent");
			assert.notMatch(text, /^skills:/m, "no skills in frontmatter");
			assert.notInclude(text, "## Skills", "no skills list in the body");
		});
	}
});
