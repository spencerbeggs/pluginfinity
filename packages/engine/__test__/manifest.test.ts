import { assert, describe, it } from "@effect/vitest";
import { CLAUDE, COPILOT, PluginfinityConfig } from "@pluginfinity/targets";
import { Schema } from "effect";
import { renderManifest, serializeManifest } from "../src/manifest.js";

const config = (input: typeof PluginfinityConfig.Encoded) => Schema.decodeUnknownSync(PluginfinityConfig)(input);

const FULL = config({
	name: "full-plugin",
	description: "Fixture plugin.",
	author: { name: "A. Author", email: "a@example.com" },
	homepage: "https://example.com",
	repository: "https://example.com/repo.git",
	license: "MIT",
	keywords: ["one", "two"],
	claude: true,
	copilot: { name: "full-copilot" },
});

describe("renderManifest", () => {
	it("claude: every metadata field, in the allowlist's order, with the package version", () => {
		const manifest = renderManifest(CLAUDE, "claude", FULL, "1.2.3");
		assert.deepStrictEqual(Object.keys(manifest), [
			"name",
			"version",
			"description",
			"author",
			"homepage",
			"repository",
			"license",
			"keywords",
		]);
		assert.strictEqual(manifest.name, "full-plugin");
		assert.strictEqual(manifest.version, "1.2.3");
		assert.deepStrictEqual(manifest.author, { name: "A. Author", email: "a@example.com" });
	});

	it("copilot: $schema first, pinned to Agent Plugins 1.0, under the target's name override", () => {
		const manifest = renderManifest(COPILOT, "copilot", FULL, "1.2.3");
		assert.strictEqual(Object.keys(manifest)[0], "$schema");
		assert.strictEqual(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
		assert.strictEqual(manifest.name, "full-copilot");
	});

	it("unset metadata fields are left out, not written as null", () => {
		const manifest = renderManifest(
			CLAUDE,
			"claude",
			config({ name: "bare", description: "Bare.", claude: true }),
			"0.1.0",
		);
		assert.deepStrictEqual(manifest, { name: "bare", version: "0.1.0", description: "Bare." });
	});
});

describe("serializeManifest", () => {
	it("is tab-indented JSON with one final newline", () => {
		assert.strictEqual(serializeManifest({ name: "x" }), '{\n\t"name": "x"\n}\n');
	});
});
