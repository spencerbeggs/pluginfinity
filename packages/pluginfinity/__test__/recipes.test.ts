import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string): string => readFileSync(`${ROOT}${path}`, "utf8");
const RECIPES = "plugins/pluginfinity/skills/hook-authoring/references/recipes.md";
const DOGFOOD = "plugins/dogfood/";

// Each recipe is a real dogfood hook: its config entry, script and bats test
// must match dogfood exactly, so the recipe is tested on both hosts.
const MAP = [
	{
		title: "Command guard",
		config: '{ matcher: "Bash", script: "hooks/pre-tool-use.sh", timeout: 5 }',
		script: "hooks/pre-tool-use.sh",
		test: "PreToolUse denies the marker command on both targets",
	},
	{
		title: "Startup context",
		config: '{ script: "hooks/session-start.sh", timeout: 5 }',
		script: "hooks/session-start.sh",
		test: "SessionStart adds context naming the host, on both targets",
	},
	{
		title: "Post-edit reaction",
		config: '{ matcher: "Edit|Write", script: "hooks/post-edit.sh", timeout: 5 }',
		script: "hooks/post-edit.sh",
		test: "PostToolUse names the edited file on both targets and both input shapes",
	},
	{
		title: "Stop gate",
		config: '{ script: "hooks/stop.sh", timeout: 5 }',
		script: "hooks/stop.sh",
		test: "Stop blocks once when the marker file exists",
	},
	{
		title: "Subagent context",
		config: '{ script: "hooks/subagent-start.sh", timeout: 5 }',
		script: "hooks/subagent-start.sh",
		test: "SubagentStart adds context on both targets",
	},
] as const;

/** The fenced blocks under `## Recipe: <title>`, in order, as [lang, body]. */
const recipeBlocks = (doc: string, title: string): ReadonlyArray<readonly [string, string]> => {
	const start = doc.indexOf(`## Recipe: ${title}\n`);
	if (start < 0) return [];
	const rest = doc.slice(start + 1);
	const next = rest.indexOf("\n## ");
	const section = next < 0 ? rest : rest.slice(0, next);
	return [...section.matchAll(/^```(\w+)\n([\s\S]*?)^```$/gm)].map((m) => [m[1] ?? "", m[2] ?? ""] as const);
};

/** The `@test "<name>" { … }` block from a bats file, through its closing brace at column 0. */
const batsTest = (bats: string, name: string): string => {
	const start = bats.indexOf(`@test "${name}" {`);
	if (start < 0) return "";
	const end = bats.indexOf("\n}\n", start);
	return bats.slice(start, end + 2);
};

describe("hook-authoring recipes", () => {
	const doc = read(RECIPES);
	const config = read(`${DOGFOOD}pluginfinity.config.ts`);
	const bats = read(`${DOGFOOD}__test__/hooks.bats`);

	for (const recipe of MAP) {
		it(`"${recipe.title}" matches dogfood's config entry, script and test`, () => {
			const blocks = recipeBlocks(doc, recipe.title);
			assert.deepStrictEqual(
				blocks.map(([lang]) => lang),
				["ts", "bash", "bash"],
				"config, script, test",
			);
			const [[, ts], [, script], [, test]] = blocks as [
				readonly [string, string],
				readonly [string, string],
				readonly [string, string],
			];
			assert.include(config, recipe.config, "the entry exists in dogfood's config");
			assert.include(ts, recipe.config, "the recipe shows that entry");
			assert.strictEqual(script, read(`${DOGFOOD}${recipe.script}`), "the script is dogfood's, byte for byte");
			assert.strictEqual(test, `${batsTest(bats, recipe.test)}\n`, "the test is dogfood's, byte for byte");
		});
	}

	it("every recipe says what to change when copying it", () => {
		for (const recipe of MAP) {
			const start = doc.indexOf(`## Recipe: ${recipe.title}\n`);
			const next = doc.indexOf("\n## ", start + 1);
			assert.include(doc.slice(start, next < 0 ? undefined : next), "**Change for your plugin:**", recipe.title);
		}
	});
});
