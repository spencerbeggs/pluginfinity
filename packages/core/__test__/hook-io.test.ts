import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { Schema } from "effect";
import type { ClaudeHookEvent } from "../src/index.js";
import { CLAUDE_HOOK_EVENTS, HOOK_IO, TOOL_INPUTS, hookEventsZig, hookSchemaFiles } from "../src/index.js";

const SCHEMAS_DIR = fileURLToPath(
	new URL("../../../plugins/pluginfinity/skills/hook-events/references/schemas/", import.meta.url),
);
const FIXTURES_DIR = fileURLToPath(new URL("../../../plugins/dogfood/__test__/fixtures/", import.meta.url));

interface Json {
	readonly [key: string]: unknown;
}
const jsonSchema = (schema: Schema.Top): Json => Schema.toJsonSchemaDocument(schema).schema as Json;

// What a hook author gets wrong: a field the event does not read. Strict decoding rejects it.
const strict = (schema: Schema.Codec<unknown, unknown>) => (value: unknown) =>
	Schema.decodeUnknownSync(schema)(value, { onExcessProperty: "error", errors: "all" });
const loose = (schema: Schema.Codec<unknown, unknown>) => (value: unknown) => Schema.decodeUnknownSync(schema)(value);

/** Every schema node that declares properties, with a path for the failure message. */
const propertyNodes = (node: unknown, path: string): Array<[string, Json]> => {
	if (Array.isArray(node)) return node.flatMap((item, index) => propertyNodes(item, `${path}[${index}]`));
	if (typeof node !== "object" || node === null) return [];
	const here = node as Json;
	const own = Object.entries((here.properties ?? {}) as Json).map(([key, value]): [string, Json] => [
		`${path}.${key}`,
		value as Json,
	]);
	return [
		...own,
		...Object.entries(here).flatMap(([key, value]) =>
			key === "properties"
				? Object.entries(value as Json).flatMap(([name, child]) => propertyNodes(child, `${path}.${name}`))
				: propertyNodes(value, `${path}.${key}`),
		),
	];
};

describe("HOOK_IO", () => {
	it("has an input and an output schema for exactly the events in CLAUDE_HOOK_EVENTS", () => {
		assert.deepStrictEqual(Object.keys(HOOK_IO).sort(), [...CLAUDE_HOOK_EVENTS].sort());
	});

	it("pins hook_event_name to the event and titles both schemas after it", () => {
		for (const event of CLAUDE_HOOK_EVENTS) {
			const input = jsonSchema(HOOK_IO[event].input);
			assert.deepStrictEqual((input.properties as Json).hook_event_name, {
				type: "string",
				enum: [event],
				description: `Always "${event}".`,
			});
			assert.strictEqual(input.title, `${event} hook input`);
			assert.strictEqual(jsonSchema(HOOK_IO[event].output).title, `${event} hook output`);
		}
	});

	it("describes every schema and every property, so no field reaches an agent unexplained", () => {
		const all: Array<[string, Schema.Top]> = [
			...CLAUDE_HOOK_EVENTS.flatMap(
				(event): Array<[string, Schema.Top]> => [
					[`${event}.input`, HOOK_IO[event].input],
					[`${event}.output`, HOOK_IO[event].output],
				],
			),
			...Object.entries(TOOL_INPUTS).map(([tool, schema]): [string, Schema.Top] => [`tool-input.${tool}`, schema]),
		];
		const undescribed: Array<string> = [];
		for (const [name, schema] of all) {
			const root = jsonSchema(schema);
			if (typeof root.description !== "string" || root.description.length < 20) undescribed.push(name);
			for (const [path, node] of propertyNodes(root, name)) {
				if (typeof node.description !== "string" || node.description.length === 0) undescribed.push(path);
			}
		}
		assert.deepStrictEqual(undescribed, []);
		// The walk can fail: a bare field is reported.
		assert.deepStrictEqual(
			propertyNodes(jsonSchema(Schema.Struct({ bare: Schema.String })), "x")
				.filter(([, node]) => node.description === undefined)
				.map(([path]) => path),
			["x.bare"],
		);
	});

	it("keeps inputs open to fields Claude Code adds later", () => {
		const decoded = loose(HOOK_IO.Stop.input)({
			session_id: "s",
			transcript_path: "/t",
			cwd: "/",
			hook_event_name: "Stop",
			stop_hook_active: false,
			a_field_from_next_month: 1,
		});
		assert.isObject(decoded);
		assert.strictEqual(jsonSchema(HOOK_IO.Stop.input).additionalProperties, true);
	});

	it("rejects an input for another event, or one missing a field the event always sends", () => {
		const base = { session_id: "s", transcript_path: "/t", cwd: "/" };
		assert.throws(() =>
			loose(HOOK_IO.Stop.input)({ ...base, hook_event_name: "SubagentStop", stop_hook_active: false }),
		);
		assert.throws(() => loose(HOOK_IO.PreToolUse.input)({ ...base, hook_event_name: "PreToolUse", tool_name: "Bash" }));
	});
});

describe("the documented examples", () => {
	const common = {
		session_id: "abc123",
		transcript_path: "/home/user/.claude/projects/x/transcript.jsonl",
		cwd: "/home/user/my-project",
	};
	const inputs: ReadonlyArray<readonly [ClaudeHookEvent, Json]> = [
		[
			"PreToolUse",
			{
				...common,
				prompt_id: "550e8400-e29b-41d4-a716-446655440000",
				scratchpad_dir: "/tmp/claude-1000/x/abc123/scratchpad",
				permission_mode: "default",
				hook_event_name: "PreToolUse",
				tool_name: "Bash",
				tool_input: { command: "npm test", description: "Run test suite", timeout: 120000, run_in_background: false },
				tool_use_id: "toolu_01ABC123",
			},
		],
		[
			"SessionStart",
			{
				...common,
				hook_event_name: "SessionStart",
				source: "resume",
				model: "claude-opus-5",
				seconds_since_last_response: 5400,
				context_tokens: 182340,
				prompt_cache_likely_expired: true,
				estimated_cache_write_usd: 1.1396,
			},
		],
		[
			"Stop",
			{
				...common,
				permission_mode: "default",
				hook_event_name: "Stop",
				stop_hook_active: true,
				last_assistant_message: "Done.",
				background_tasks: [
					{
						id: "task-001",
						type: "shell",
						status: "running",
						description: "tail logs",
						command: "tail -f /var/log/syslog",
					},
				],
				session_crons: [{ id: "cron-001", schedule: "0 9 * * 1-5", recurring: true, prompt: "check the build" }],
			},
		],
		[
			"PermissionRequest",
			{
				...common,
				permission_mode: "default",
				hook_event_name: "PermissionRequest",
				tool_name: "Bash",
				tool_input: { command: "rm -rf node_modules" },
				permission_suggestions: [
					{
						type: "addRules",
						rules: [{ toolName: "Bash", ruleContent: "rm -rf node_modules" }],
						behavior: "allow",
						destination: "localSettings",
					},
				],
			},
		],
		[
			"PreModelSwitch",
			{
				...common,
				hook_event_name: "PreModelSwitch",
				from_model: "claude-sonnet-5",
				to_model: "claude-opus-5",
				requested_model: "opus",
				source: "command",
				context_tokens: 182340,
				prompt_cache_warm: true,
				cache_ttl: "5m",
				estimated_cache_write_usd: 1.1396,
				pricing: "catalog",
			},
		],
		["PreCompact", { ...common, hook_event_name: "PreCompact", trigger: "manual", custom_instructions: null }],
		[
			"Elicitation",
			{
				...common,
				hook_event_name: "Elicitation",
				mcp_server_name: "my-mcp-server",
				message: "Please provide your username",
				mode: "form",
				requested_schema: { type: "object", properties: { username: { type: "string", title: "Username" } } },
			},
		],
	];
	it("inputs decode with no key the schema does not know", () => {
		for (const [event, example] of inputs) {
			assert.doesNotThrow(() => strict(HOOK_IO[event].input)(example), event);
		}
	});

	const outputs: ReadonlyArray<readonly [ClaudeHookEvent, Json]> = [
		[
			"PreToolUse",
			{
				hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "no" },
			},
		],
		[
			"PermissionRequest",
			{
				hookSpecificOutput: {
					hookEventName: "PermissionRequest",
					decision: { behavior: "allow", updatedInput: { command: "npm run lint" } },
				},
			},
		],
		["Stop", { decision: "block", reason: "Tests must pass" }],
		[
			"UserPromptSubmit",
			{
				decision: "block",
				reason: "no",
				hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: true },
			},
		],
		[
			"SessionStart",
			{
				hookSpecificOutput: {
					hookEventName: "SessionStart",
					additionalContext: "branch: main",
					sessionTitle: "x",
					reloadSkills: true,
				},
			},
		],
		["PermissionDenied", { hookSpecificOutput: { hookEventName: "PermissionDenied", retry: true } }],
		[
			"Elicitation",
			{ hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: { username: "alice" } } },
		],
		["PreSkillShellCommand", { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" } }],
		["Notification", { terminalSequence: "\u001b]777;notify;Claude Code;hi\u0007" }],
		[
			"PreModelSwitch",
			{
				hookSpecificOutput: {
					hookEventName: "PreModelSwitch",
					permissionDecision: "ask",
					permissionDecisionReason: "costly",
				},
			},
		],
	];
	it("outputs decode with no key the event does not read", () => {
		for (const [event, example] of outputs) {
			assert.doesNotThrow(() => strict(HOOK_IO[event].output)(example), event);
		}
	});

	it("a field the event does not read is rejected, which is the mistake the schemas exist to catch", () => {
		// PreToolUse has no retry, Notification discards systemMessage, and a model switch cannot be deferred.
		assert.throws(() =>
			strict(HOOK_IO.PreToolUse.output)({ hookSpecificOutput: { hookEventName: "PreToolUse", retry: true } }),
		);
		assert.throws(() => strict(HOOK_IO.Notification.output)({ systemMessage: "hi" }));
		assert.throws(() =>
			strict(HOOK_IO.PreModelSwitch.output)({
				hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "defer" },
			}),
		);
		assert.throws(() => strict(HOOK_IO.Stop.output)({ hookSpecificOutput: { hookEventName: "SubagentStop" } }));
	});
});

describe("the dogfood fixtures", () => {
	it("every Claude-shaped fixture decodes with its event's input schema", () => {
		const checked: Array<string> = [];
		for (const name of readdirSync(FIXTURES_DIR).filter(
			(file) => file.endsWith(".json") && !file.includes(".copilot."),
		)) {
			const fixture = JSON.parse(readFileSync(`${FIXTURES_DIR}${name}`, "utf8")) as {
				hook_event_name: ClaudeHookEvent;
			};
			assert.doesNotThrow(() => strict(HOOK_IO[fixture.hook_event_name].input)(fixture), name);
			checked.push(name);
		}
		assert.isAbove(checked.length, 5, "the fixtures were found");
	});
});

describe("the generated Zig event types", () => {
	const ZIG_EVENTS = fileURLToPath(new URL("../../../zig/src/events.zig", import.meta.url));

	it("match the schemas; regenerate with `pnpm --filter @pluginfinity/core run hook-io:zig`", () => {
		assert.strictEqual(readFileSync(ZIG_EVENTS, "utf8"), hookEventsZig());
	});

	it("declare a struct for every event and tool, with reserved words quoted", () => {
		const source = hookEventsZig();
		for (const event of CLAUDE_HOOK_EVENTS) assert.include(source, `pub const ${event} = struct {`);
		for (const tool of Object.keys(TOOL_INPUTS)) assert.include(source, `    pub const ${tool} = struct {`);
		// StopFailure's `error` is a Zig keyword and Grep's `-i` is not an identifier.
		assert.include(source, '@"error": []const u8,');
		assert.include(source, '@"-i": ?bool = null,');
		// A common field is optional even though Claude Code always sends it; an event's own is not.
		assert.include(source, "session_id: ?[]const u8 = null,");
		assert.include(source, "tool_name: []const u8,");
	});
});

describe("the generated schema files", () => {
	it("match the schemas; regenerate with `pnpm --filter @pluginfinity/ai-plugins run schemas`", () => {
		const files = hookSchemaFiles();
		assert.strictEqual(files.length, CLAUDE_HOOK_EVENTS.length * 2 + Object.keys(TOOL_INPUTS).length);
		for (const file of files) {
			assert.strictEqual(readFileSync(`${SCHEMAS_DIR}${file.name}`, "utf8"), file.content, file.name);
		}
		assert.deepStrictEqual(readdirSync(SCHEMAS_DIR).sort(), files.map((file) => file.name).sort());
	});

	it("are JSON Schema 2020-12 documents, deterministic across runs", () => {
		const [first] = hookSchemaFiles();
		assert.strictEqual(JSON.parse(first?.content ?? "{}").$schema, "https://json-schema.org/draft/2020-12/schema");
		assert.deepStrictEqual(hookSchemaFiles(), hookSchemaFiles());
	});
});
