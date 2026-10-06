import { assert, describe, it } from "@effect/vitest";
import { CLAUDE_HOOK_EVENTS } from "@pluginfinity/core";
import { CLAUDE, COPILOT, PluginfinityConfig } from "@pluginfinity/targets";
import { Schema } from "effect";
import { ignoredOutput } from "../src/hook-output.js";
import { targetHooks } from "../src/hooks.js";
import { supportedEvents } from "./utils/supports.js";

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
		});
	}
});
