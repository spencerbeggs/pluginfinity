import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { CLAUDE_HOOK_EVENTS, HookEntry, Hooks, makeHooks } from "../src/index.js";
import { decodeStrict } from "./utils/decode.js";

const decodeEntry = decodeStrict(HookEntry);
const decodeHooks = decodeStrict(Hooks);

describe("CLAUDE_HOOK_EVENTS", () => {
	it("lists the 33 Claude Code hook events once each", () => {
		assert.strictEqual(CLAUDE_HOOK_EVENTS.length, 33);
		assert.strictEqual(new Set(CLAUDE_HOOK_EVENTS).size, 33);
		assert.include(CLAUDE_HOOK_EVENTS, "PreToolUse");
		assert.include(CLAUDE_HOOK_EVENTS, "PostModelSwitch");
	});
});

describe("HookEntry", () => {
	it.effect("accepts a script hook with args, matcher, timeout and fallback", () =>
		Effect.gen(function* () {
			const entry = {
				script: "hooks/guard.sh",
				args: ["--fast"],
				matcher: "Bash",
				timeout: 10,
				fallback: "omit",
			} as const;
			assert.deepStrictEqual(yield* decodeEntry(entry), entry);
		}),
	);

	it.effect("accepts a command hook", () =>
		Effect.gen(function* () {
			const entry = { command: `bash "\${PLUGIN_ROOT}/hooks/x.sh" --quiet` };
			assert.deepStrictEqual(yield* decodeEntry(entry), entry);
		}),
	);

	const rejected: ReadonlyArray<readonly [string, unknown]> = [
		["both script and command", { script: "hooks/x.sh", command: "x" }],
		["command with args", { command: "x", args: [] }],
		["neither script nor command", { matcher: "Bash" }],
		["a script outside the plugin root", { script: "../x.sh" }],
		["an absolute script path", { script: "/etc/x.sh" }],
		["a script path with a backslash", { script: "hooks\\x.sh" }],
		["a dot-dot segment mid-path", { script: "hooks/../../x.sh" }],
		["a path containing a newline", { script: "a\n/../../x.sh" }],
		["a path containing a control character", { script: "hooks/\tx.sh" }],
		["an empty command", { command: "" }],
		["a zero timeout", { script: "hooks/x.sh", timeout: 0 }],
		["a negative timeout", { script: "hooks/x.sh", timeout: -5 }],
		["a fractional timeout", { script: "hooks/x.sh", timeout: 1.5 }],
		["an unknown fallback", { script: "hooks/x.sh", fallback: "degrade" }],
	];
	for (const [label, input] of rejected) {
		it.effect(`rejects ${label}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decodeEntry(input));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}
});

describe("Hooks", () => {
	it.effect("accepts any subset of Claude events, including an empty list", () =>
		Effect.gen(function* () {
			const hooks = { PreToolUse: [{ script: "hooks/a.sh" }], Stop: [] } as const;
			assert.deepStrictEqual(yield* decodeHooks(hooks), hooks);
			assert.deepStrictEqual(yield* decodeHooks({}), {});
		}),
	);

	it.effect("rejects an event Claude Code does not have", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(decodeHooks({ subagentStart: [] }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);

	it.effect("makeHooks admits exactly the events it is given", () =>
		Effect.gen(function* () {
			const decode = decodeStrict(makeHooks(["PreToolUse", "subagentStart"] as const));
			assert.deepStrictEqual(yield* decode({ subagentStart: [] }), { subagentStart: [] });
			const error = yield* Effect.flip(decode({ Stop: [] }));
			assert.strictEqual(error._tag, "SchemaError");
		}),
	);
});
