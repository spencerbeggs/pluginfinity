import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { AGENT_FIELDS, AgentFrontmatter, ComponentName, SKILL_FIELDS, SkillFrontmatter } from "../src/index.js";
import { decodeStrict } from "./utils/decode.js";

const decodeSkill = decodeStrict(SkillFrontmatter);
const decodeAgent = decodeStrict(AgentFrontmatter);
const decodeName = decodeStrict(ComponentName);

describe("ComponentName", () => {
	it.effect("accepts names up to 64 characters", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* decodeName("a".repeat(64)), "a".repeat(64));
		}),
	);

	for (const bad of ["a".repeat(65), "Upper", "two--hyphens", "-lead"]) {
		it.effect(`rejects ${JSON.stringify(bad.length > 20 ? `${bad.length} chars` : bad)}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeName(bad));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}
});

describe("SkillFrontmatter", () => {
	it.effect("accepts every Claude Code skill field and a targets block", () =>
		Effect.gen(function* () {
			const skill = {
				name: "hook-scripts",
				description: "Writes hook scripts",
				license: "MIT",
				compatibility: "bash 5",
				metadata: { owner: "spencer" },
				"allowed-tools": ["Read", "Bash"],
				"disallowed-tools": "Write",
				when_to_use: "When a hook is needed",
				"argument-hint": "[event]",
				arguments: ["event"],
				"disable-model-invocation": false,
				"user-invocable": true,
				model: "inherit",
				effort: "high" as const,
				context: "fork" as const,
				agent: "general-purpose",
				background: false,
				hooks: { PreToolUse: [] },
				paths: ["hooks/**"],
				shell: "bash" as const,
				targets: { copilot: false as const, claude: { model: "opus" } },
			};
			assert.deepStrictEqual(yield* decodeSkill(skill), skill);
		}),
	);

	it.effect("needs only a description", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(yield* decodeSkill({ description: "x" }), { description: "x" });
		}),
	);

	const rejected: ReadonlyArray<readonly [string, unknown]> = [
		["a misspelt field", { description: "x", "allowed-tool": "Read" }],
		["a missing description", { name: "x" }],
		["a description over 1024 characters", { description: "x".repeat(1025) }],
		["an unknown effort", { description: "x", effort: "extreme" }],
		["a targets value that is true", { description: "x", targets: { copilot: true } }],
	];
	for (const [label, input] of rejected) {
		it.effect(`rejects ${label}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeSkill(input));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}
});

describe("AgentFrontmatter", () => {
	it.effect("accepts every Claude Code agent field and a targets block", () =>
		Effect.gen(function* () {
			const agent = {
				name: "reviewer",
				description: "Reviews a change",
				tools: ["Read", "Grep"],
				disallowedTools: "Write",
				model: "sonnet",
				effort: "medium" as const,
				permissionMode: "plan" as const,
				maxTurns: 20,
				skills: ["hook-scripts"],
				mcpServers: ["docs", { local: { command: "bash" } }],
				hooks: { Stop: [] },
				memory: "project" as const,
				background: false,
				omitClaudeMd: true,
				isolation: "worktree" as const,
				color: "blue" as const,
				initialPrompt: "Start here",
				experimental: { cacheTtl: "1h" as const },
				targets: { copilot: { target: "github-copilot" } },
			};
			assert.deepStrictEqual(yield* decodeAgent(agent), agent);
		}),
	);

	const rejected: ReadonlyArray<readonly [string, unknown]> = [
		["a missing name", { description: "x" }],
		["a missing description", { name: "x" }],
		["a zero maxTurns", { name: "x", description: "x", maxTurns: 0 }],
		["an unknown color", { name: "x", description: "x", color: "teal" }],
		["a Copilot-only field at the top level", { name: "x", description: "x", handoffs: [] }],
	];
	for (const [label, input] of rejected) {
		it.effect(`rejects ${label}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeAgent(input));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}
});

describe("field lists", () => {
	it("list every frontmatter field except targets", () => {
		assert.strictEqual(SKILL_FIELDS.length, 20);
		assert.strictEqual(AGENT_FIELDS.length, 18);
		assert.notInclude(SKILL_FIELDS as ReadonlyArray<string>, "targets");
		assert.notInclude(AGENT_FIELDS as ReadonlyArray<string>, "targets");
	});
});
