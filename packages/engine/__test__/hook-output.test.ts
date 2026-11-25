import { assert, describe, it } from "@effect/vitest";
import type { ClaudeHookEvent } from "@pluginfinity/core";
import { CLAUDE_HOOK_EVENTS, HOOK_IO } from "@pluginfinity/core";
import { CLAUDE, COPILOT, PluginfinityConfig } from "@pluginfinity/targets";
import { Schema } from "effect";
import { ignoredOutput } from "../src/hook-output.js";
import { targetHooks } from "../src/hooks.js";
import { helperResponses, supportedEvents } from "./utils/supports.js";

const config = (input: typeof PluginfinityConfig.Encoded) => Schema.decodeUnknownSync(PluginfinityConfig)(input);

const hooked = config({
	name: "hooked",
	description: "Fixture plugin.",
	claude: true,
	copilot: true,
	hooks: { PreToolUse: [{ script: "hooks/p.sh" }] },
});

const run = (target: typeof COPILOT, id: "claude" | "copilot", source: string) =>
	ignoredOutput(id, target, targetHooks(target, id, hooked).events, () => source);

describe("ignoredOutput", () => {
	it("flags hook_context in a Copilot PreToolUse script", () => {
		assert.deepStrictEqual(run(COPILOT, "copilot", '. lib.sh\nhook_context "x"\n'), [
			{ target: "copilot", path: "hooks/p.sh", kind: "hook-output-ignored", name: "PreToolUse:hook_context" },
		]);
	});

	it("flags hook_system_message wherever the host drops it", () => {
		assert.deepStrictEqual(
			run(COPILOT, "copilot", 'hook_system_message "x"').map((note) => note.name),
			["PreToolUse:hook_system_message"],
		);
	});

	it("flags nothing on Claude, which honours hook_context on PreToolUse", () => {
		assert.deepStrictEqual(run(CLAUDE, "claude", 'hook_context "x"'), []);
	});

	it("ignores a helper named only in a comment", () => {
		assert.deepStrictEqual(run(COPILOT, "copilot", "# hook_context is not used\nfoo # hook_context\n"), []);
	});

	it("matches the helper as a word", () => {
		assert.deepStrictEqual(run(COPILOT, "copilot", "my_hook_context_x; hook_contextual"), []);
	});

	it("does not mistake a # inside quotes for a comment", () => {
		assert.deepStrictEqual(
			run(COPILOT, "copilot", 'echo "a # b"; hook_context "x"').map((note) => note.name),
			["PreToolUse:hook_context"],
		);
	});

	it("skips command entries and a script it cannot read", () => {
		const events = [{ event: "PreToolUse", name: "preToolUse", entries: [{ command: "hook_context x" }] }];
		assert.deepStrictEqual(
			ignoredOutput("copilot", COPILOT, events, () => "hook_context"),
			[],
		);
		assert.deepStrictEqual(
			ignoredOutput("copilot", COPILOT, targetHooks(COPILOT, "copilot", hooked).events, () => undefined),
			[],
		);
	});
});

describe("hooks.output against hook_supports", () => {
	for (const [id, target] of [
		["claude", CLAUDE],
		["copilot", COPILOT],
	] as const) {
		it(`${id}: the target description equals the library's answers for every event`, () => {
			const answers = supportedEvents(id, CLAUDE_HOOK_EVENTS);
			assert.isAbove(answers.context.length + answers.system_message.length, 0, "the runner saw the library");
			assert.deepStrictEqual([...target.hooks.output.context].sort(), [...answers.context].sort());
			assert.deepStrictEqual([...target.hooks.output.system_message].sort(), [...answers.system_message].sort());
			assert.deepStrictEqual([...target.hooks.envShell].sort(), [...answers["env-shell"]].sort());
		});
	}
});

// The event schemas in @pluginfinity/core are written from Claude Code's hook docs. What the
// hook library offers on Claude Code must be what those schemas say the host reads.
describe("hook_supports on Claude Code against the hook event schemas", () => {
	interface Json {
		readonly [key: string]: unknown;
	}
	const outputOf = (event: ClaudeHookEvent): Json =>
		(Schema.toJsonSchemaDocument(HOOK_IO[event].output).schema as Json).properties as Json;
	const specificOf = (event: ClaudeHookEvent): Json =>
		(((outputOf(event).hookSpecificOutput ?? {}) as Json).properties ?? {}) as Json;
	const eventsWhere = (test: (event: ClaudeHookEvent) => boolean) => CLAUDE_HOOK_EVENTS.filter(test).sort();
	const answers = supportedEvents("claude", CLAUDE_HOOK_EVENTS);

	it("context is offered exactly where the schema has additionalContext", () => {
		assert.deepStrictEqual(
			[...answers.context].sort(),
			eventsWhere((event) => "additionalContext" in specificOf(event)),
		);
	});

	it("a system message is offered exactly where the schema keeps systemMessage, and the user sees it", () => {
		// DirectoryAdded reads systemMessage but hands it to Claude or the debug log, never the user.
		assert.deepStrictEqual(
			[...answers.system_message].sort(),
			eventsWhere((event) => "systemMessage" in outputOf(event) && event !== "DirectoryAdded"),
		);
	});

	it("a block is offered exactly where the schema reads a top-level decision of block", () => {
		// PreToolUse's decision is the deprecated approve|block; PostToolUseFailure's is listed in the
		// docs' summary table and contradicted by the event's own section, so the library does not offer it.
		const blocks = (event: ClaudeHookEvent) =>
			JSON.stringify((outputOf(event).decision as Json | undefined)?.enum) === JSON.stringify(["block"]);
		assert.deepStrictEqual(
			[...answers.block].sort(),
			eventsWhere((event) => blocks(event) && event !== "PostToolUseFailure"),
		);
	});

	it("a deny is offered exactly where the schema takes a permissionDecision of deny", () => {
		const denies = (event: ClaudeHookEvent) =>
			(((specificOf(event).permissionDecision ?? {}) as Json).enum as ReadonlyArray<string> | undefined)?.includes(
				"deny",
			) === true;
		assert.deepStrictEqual([...answers.deny].sort(), eventsWhere(denies));
	});
});

// Every response the hook library can send on Claude Code, checked against the schema of the
// event it answers: no helper may send a field the host does not read on that event.
describe("the hook library's responses on Claude Code against the hook event schemas", () => {
	const HELPERS = {
		noop: "hook_noop",
		context: 'hook_context "some context"',
		deny: 'hook_deny "a reason"',
		"deny, no reason": "hook_deny",
		allow: 'hook_allow "a reason"',
		"allow, rewritten input": `hook_allow "" '{"command":"ls"}'`,
		ask: 'hook_ask "a reason"',
		block: 'hook_block "a reason"',
		"system message": 'hook_system_message "a message"',
		"relay of a Claude-shaped decision": `hook_relay '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"r"}}'`,
		"relay of a block": `hook_relay '{"decision":"block","reason":"r","systemMessage":"m"}'`,
	};
	const strict = (event: ClaudeHookEvent, value: unknown) =>
		Schema.decodeUnknownSync(HOOK_IO[event].output)(value, { onExcessProperty: "error", errors: "all" });
	const failures = (responses: ReturnType<typeof helperResponses>, allowEmpty: boolean): ReadonlyArray<string> =>
		responses.flatMap(({ event, helper, output }) => {
			if (output === "") return allowEmpty ? [] : [`${event} / ${helper}: sent nothing`];
			try {
				strict(event as ClaudeHookEvent, JSON.parse(output));
				return [];
			} catch (error) {
				return [`${event} / ${helper}: ${output} -> ${String(error).split("\n").slice(0, 3).join(" ")}`];
			}
		});

	it("every helper on every event sends a response that event's output schema accepts", () => {
		const responses = helperResponses("claude", CLAUDE_HOOK_EVENTS, HELPERS);
		assert.strictEqual(responses.length, CLAUDE_HOOK_EVENTS.length * Object.keys(HELPERS).length);
		assert.deepStrictEqual(failures(responses, false), []);
		// The run reached the library: a deny on PreToolUse is a real decision, and the same call is a no-op on Stop.
		const sent = (event: string, helper: string) =>
			responses.find((one) => one.event === event && one.helper === helper)?.output;
		assert.include(sent("PreToolUse", "deny"), '"permissionDecision":"deny"');
		assert.strictEqual(sent("Stop", "deny"), "{}");
		assert.include(sent("PreModelSwitch", "ask"), '"hookEventName":"PreModelSwitch"');
	}, 60_000);

	it("a crash in a failClosed hook sends nothing, or a response the event's schema accepts", () => {
		const responses = helperResponses(
			"claude",
			CLAUDE_HOOK_EVENTS,
			{ crash: "false" },
			{ PLUGINFINITY_FAIL_CLOSED: "1" },
		);
		assert.deepStrictEqual(failures(responses, true), []);
		const sent = (event: string) => responses.find((one) => one.event === event)?.output ?? "";
		assert.include(sent("PreToolUse"), '"permissionDecision":"deny"');
		assert.include(sent("UserPromptSubmit"), '"decision":"block"');
		assert.strictEqual(sent("TeammateIdle"), "");
		assert.strictEqual(sent("SessionStart"), "");
	}, 60_000);

	it("the check can fail: a response with a field the event does not read is reported", () => {
		assert.throws(() => strict("Stop", { hookSpecificOutput: { hookEventName: "Stop", permissionDecision: "deny" } }));
		assert.throws(() => strict("Notification", { systemMessage: "m" }));
	});
});
