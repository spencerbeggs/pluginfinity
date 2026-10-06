import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";

const BUILDS = fileURLToPath(new URL("../../../plugins/pluginfinity/builds/", import.meta.url));
const SKILLS = ["pluginfinity", "hook-authoring", "hook-events", "plugin-scripts", "migrating-hooks"];
const READ_FIRST = "Before you act, read these skills";

/** Where each host's build puts its agents; Copilot nests them under com.github.copilot/. */
const AGENT_DIRS = { claude: "claude/agents/", copilot: "copilot/com.github.copilot/agents/" } as const;

/** The built agent file for a host: the one file under agents/ whose name starts with plugin-engineer. */
const agent = (host: "claude" | "copilot"): string => {
	const dir = `${BUILDS}${AGENT_DIRS[host]}`;
	const file = existsSync(dir) ? readdirSync(dir).find((name) => name.startsWith("plugin-engineer")) : undefined;
	return file === undefined ? "" : readFileSync(`${dir}${file}`, "utf8");
};

describe("plugin-engineer builds", () => {
	it("claude preloads the five skills and has no read-first block", () => {
		const text = agent("claude");
		for (const skill of SKILLS) assert.match(text, new RegExp(`^\\s+- ${skill}$`, "m"), skill);
		assert.notInclude(text, READ_FIRST);
	});

	it("copilot is told to read the five skills, since it cannot preload them", () => {
		const text = agent("copilot");
		assert.include(text, READ_FIRST);
		for (const skill of SKILLS) assert.include(text, skill);
	});

	it("both builds carry the never-edit-builds rule", () => {
		for (const host of ["claude", "copilot"] as const) assert.include(agent(host), "Never edit a file under `builds/`");
	});
});
