import { assert, describe, it } from "@effect/vitest";
import { AGENT_FIELDS, CLAUDE_HOOK_EVENTS, LSP_FIELDS, SKILL_FIELDS, Target, drop, rename } from "@pluginfinity/core";
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

		it("names every frontmatter tool at run time too", () => {
			assert.isEmpty(
				Object.keys(entry.target.tools.names).filter((name) => !(name in entry.target.tools.runtime.names)),
			);
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

	it("grants Grep, Glob, WebFetch and WebSearch by their literal names and drops TodoWrite (measured)", () => {
		const names = copilot?.tools.names;
		assert.strictEqual(names?.Grep, "grep");
		assert.strictEqual(names?.Glob, "glob");
		assert.strictEqual(names?.WebFetch, "web_fetch");
		assert.strictEqual(names?.WebSearch, "web_search");
		assert.deepStrictEqual(names?.TodoWrite, drop);
		assert.strictEqual(names?.Bash, "execute");
		assert.strictEqual(names?.Read, "read");
		assert.strictEqual(names?.Edit, "edit");
		assert.strictEqual(names?.Agent, "agent");
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

it("the run-time totality check flags a frontmatter tool the run-time table lacks", () => {
	const copilot = TARGETS.find((t) => t.id === "copilot")?.target;
	const runtime = Object.keys(copilot?.tools.runtime.names ?? {}).slice(1);
	assert.isAbove(Object.keys(copilot?.tools.names ?? {}).filter((name) => !runtime.includes(name)).length, 0);
});

it("Claude spells plugin tools, agents and skills with its plugin prefix and keeps unlisted tools", () => {
	const claude = TARGETS.find((t) => t.id === "claude")?.target;
	assert.deepStrictEqual(claude?.tools.runtime, {
		names: {},
		mcp: "mcp__plugin_{plugin}_{server}__{tool}",
		unlisted: "keep",
	});
	assert.strictEqual(claude?.agents.id, "{plugin}:{agent}");
	assert.strictEqual(claude?.skills.invoke, "/{plugin}:{skill}");
});

describe("the copilot run-time names (measured on Copilot CLI 1.0.92)", () => {
	const copilot = TARGETS.find((entry) => entry.id === "copilot")?.target;

	it("spells built-in tools as the model sees them", () => {
		const names = copilot?.tools.runtime.names;
		assert.deepStrictEqual(
			Object.fromEntries(Object.entries(names ?? {}).filter(([, value]) => typeof value === "string")),
			{
				Read: "view",
				Bash: "bash",
				Edit: "edit",
				MultiEdit: "edit",
				Write: "create",
				Agent: "task",
				Task: "task",
				Grep: "grep",
				Glob: "glob",
				WebFetch: "web_fetch",
				WebSearch: "web_search",
				Skill: "skill",
			},
		);
	});

	it("leaves tools with no measured Copilot tool unresolved", () => {
		for (const name of ["TodoWrite", "NotebookEdit", "NotebookRead", "PowerShell"]) {
			const entry = copilot?.tools.runtime.names[name];
			assert.strictEqual(typeof entry === "object" ? entry._tag : entry, "unresolved", name);
		}
	});

	it("spells MCP tools, agents and skills as measured", () => {
		assert.strictEqual(copilot?.tools.runtime.mcp, "{server}-{tool}");
		assert.strictEqual(copilot?.tools.runtime.unlisted, "unresolved");
		assert.strictEqual(copilot?.agents.id, "{plugin}:{agent}");
		assert.strictEqual(copilot?.skills.invoke, "/{plugin}:{skill}");
	});
});
