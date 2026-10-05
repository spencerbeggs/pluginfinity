import { assert, describe, it } from "@effect/vitest";
import { AGENT_FIELDS, CLAUDE_HOOK_EVENTS, LSP_FIELDS, SKILL_FIELDS, Target, rename } from "@pluginfinity/core";
import { Effect, Schema } from "effect";
import { COPILOT_OWN_EVENTS, TARGETS } from "../src/index.js";

const decodeTarget = (input: unknown) =>
	Schema.decodeUnknownEffect(Target)(input, { onExcessProperty: "error", errors: "all" });

for (const entry of TARGETS) {
	describe(`the ${entry.id} description`, () => {
		it.effect("decodes against Target", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* decodeTarget(entry.target), entry.target);
			}),
		);

		it("is a Target instance, validated when the module loads", () => {
			assert.instanceOf(entry.target, Target);
		});

		it("maps every skill field and nothing else", () => {
			assert.sameMembers(Object.keys(entry.target.skills.fields), [...SKILL_FIELDS]);
		});

		it("maps every agent field and nothing else", () => {
			assert.sameMembers(Object.keys(entry.target.agents.fields), [...AGENT_FIELDS]);
		});

		it("maps every LSP server field and nothing else", () => {
			assert.sameMembers(Object.keys(entry.target.lsp.fields), [...LSP_FIELDS]);
		});

		it("maps every Claude Code hook event and nothing else", () => {
			assert.sameMembers(Object.keys(entry.target.hooks.events), [...CLAUDE_HOOK_EVENTS]);
		});

		it("never lists a host-only field that is already a core field of the same kind", () => {
			const skillFields = new Set<string>(SKILL_FIELDS);
			const agentFields = new Set<string>(AGENT_FIELDS);
			assert.deepStrictEqual(
				entry.target.skills.hostFields.filter((field) => skillFields.has(field)),
				[],
			);
			assert.deepStrictEqual(
				entry.target.agents.hostFields.filter((field) => agentFields.has(field)),
				[],
			);
		});
	});
}

// Positive control: the totality check sees a missing field when one is missing.
it("the totality check flags a missing skill field", () => {
	const fields = Object.keys(TARGETS[0]?.target.skills.fields ?? {}).slice(1);
	assert.throws(() => assert.sameMembers(fields, [...SKILL_FIELDS]));
});

it("Claude keeps every LSP field and Copilot renames extensionToLanguage", () => {
	const [claude, copilot] = [TARGETS.find((t) => t.id === "claude"), TARGETS.find((t) => t.id === "copilot")];
	assert.isTrue(Object.values(claude?.target.lsp.fields ?? {}).every((entry) => entry._tag === "keep"));
	assert.deepStrictEqual(copilot?.target.lsp.fields.extensionToLanguage, rename("fileExtensions"));
	assert.strictEqual(copilot?.target.lsp.fields.workspaceFolder?._tag, "unresolved");
	assert.strictEqual(copilot?.target.lsp.fields.settings?._tag, "unresolved");
	assert.strictEqual(copilot?.target.lsp.path, "com.github.copilot/lsp.json");
	assert.strictEqual(claude?.target.lsp.path, ".lsp.json");
});

it("Copilot's unresolved LSP notes point at the top-level copilot.lspServers config key", () => {
	const copilot = TARGETS.find((t) => t.id === "copilot")?.target;
	for (const field of ["settings", "workspaceFolder"] as const) {
		const entry = copilot?.lsp.fields[field];
		assert.strictEqual(entry?._tag, "unresolved");
		if (entry?._tag !== "unresolved") continue;
		assert.include(entry.note, "under copilot.lspServers");
		assert.notInclude(entry.note, "targets.copilot");
	}
});

describe("the copilot description", () => {
	const copilot = TARGETS.find((entry) => entry.id === "copilot")?.target;

	it("emits Agent Plugins 1.0 with its pinned schema", () => {
		assert.strictEqual(copilot?.manifest.format, "agent-plugins-1.0");
		assert.strictEqual(copilot?.manifest.schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
	});

	it("keeps its own events out of the Claude event table", () => {
		const claudeEvents = new Set<string>(CLAUDE_HOOK_EVENTS);
		assert.deepStrictEqual(
			COPILOT_OWN_EVENTS.filter((event) => claudeEvents.has(event)),
			[],
		);
		assert.deepStrictEqual(copilot?.hooks.ownEvents, [...COPILOT_OWN_EVENTS]);
	});
});
