import { assert, describe, it } from "@effect/vitest";
import { defineConfig } from "../src/index.js";

describe("defineConfig", () => {
	it("returns the config unchanged", () => {
		const config = { name: "foo", description: "Foo plugin", claude: { name: "baz" }, copilot: true } as const;
		assert.strictEqual(defineConfig(config), config);
	});

	it("is typed against the config schema", () => {
		// @ts-expect-error -- a typo'd target key is a type error in the editor, not just at load.
		defineConfig({ name: "foo", description: "x", claud: true });
		// @ts-expect-error -- false is not a target setting; omit the key to turn a target off.
		defineConfig({ name: "foo", description: "x", claude: false });
		// @ts-expect-error -- name is required.
		defineConfig({ description: "x", claude: true });
		// @ts-expect-error -- description is required.
		defineConfig({ name: "foo", claude: true });
		// @ts-expect-error -- claude overrides admit Claude Code events only.
		defineConfig({ name: "foo", description: "x", claude: { hooks: { userPromptTransformed: [] } } });
		defineConfig({
			name: "foo",
			description: "x",
			copilot: { hooks: { userPromptTransformed: [{ script: "hooks/a.sh" }] } },
		});
		assert.ok(true);
	});
});
