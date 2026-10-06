import { assert, describe, it } from "@effect/vitest";
import { CLAUDE, COPILOT, PluginfinityConfig } from "@pluginfinity/targets";
import { Schema } from "effect";
import { hookCommand, hookExec, hookScripts, renderHooks, targetHooks } from "../src/hooks.js";

const config = (input: typeof PluginfinityConfig.Encoded) => Schema.decodeUnknownSync(PluginfinityConfig)(input);

const BASE = {
	name: "hooked",
	description: "Fixture plugin.",
	hooks: {
		SessionStart: [{ script: "hooks/start.sh", timeout: 5 }],
		PreToolUse: [{ matcher: "Bash", command: `bash "\${PLUGIN_ROOT}/hooks/guard.sh" --quiet` }],
	},
} as const;

describe("targetHooks", () => {
	it("a target's override replaces the base entries for its event and leaves the rest", () => {
		const hooked = config({
			...BASE,
			claude: true,
			copilot: { hooks: { SessionStart: [{ script: "hooks/start.copilot.sh" }] } },
		});
		const { events } = targetHooks(COPILOT, "copilot", hooked);
		assert.deepStrictEqual(
			events.map((event) => [event.name, event.entries.length]),
			[
				["SessionStart", 1],
				["PreToolUse", 1],
			],
		);
		assert.deepStrictEqual(hookScripts(events), ["hooks/start.copilot.sh"]);
		assert.deepStrictEqual(hookScripts(targetHooks(CLAUDE, "claude", hooked).events), ["hooks/start.sh"]);
	});

	it("an override of [] removes the event on that target only", () => {
		const hooked = config({ ...BASE, claude: true, copilot: { hooks: { PreToolUse: [] } } });
		assert.deepStrictEqual(
			targetHooks(COPILOT, "copilot", hooked).events.map((event) => event.event),
			["SessionStart"],
		);
		assert.strictEqual(targetHooks(CLAUDE, "claude", hooked).events.length, 2);
	});

	it("an event the target lacks is unsupported unless every entry sets fallback omit", () => {
		const failing = config({
			name: "x",
			description: "Fixture plugin.",
			hooks: { Setup: [{ script: "hooks/a.sh" }] },
			copilot: true,
		});
		assert.deepStrictEqual(targetHooks(COPILOT, "copilot", failing).unsupported, [{ event: "Setup" }]);
		const omitted = config({
			name: "x",
			description: "Fixture plugin.",
			hooks: { Setup: [{ script: "hooks/a.sh", fallback: "omit" }] },
			copilot: true,
		});
		const result = targetHooks(COPILOT, "copilot", omitted);
		assert.deepStrictEqual([result.events, result.unsupported], [[], []]);
	});

	it("an event the target lacks whose every entry sets fallback omit is reported as omitted", () => {
		const omitted = config({
			name: "x",
			description: "Fixture plugin.",
			hooks: { Setup: [{ script: "hooks/a.sh", fallback: "omit" }], SessionStart: [{ script: "hooks/b.sh" }] },
			claude: true,
			copilot: true,
		});
		assert.deepStrictEqual(targetHooks(COPILOT, "copilot", omitted).omitted, ["Setup"]);
		assert.deepStrictEqual(targetHooks(CLAUDE, "claude", omitted).omitted, []);
	});

	it("a Copilot-only event builds under its own name", () => {
		const own = config({
			name: "x",
			description: "Fixture plugin.",
			copilot: { hooks: { errorOccurred: [{ script: "hooks/err.sh" }] } },
		});
		assert.deepStrictEqual(
			targetHooks(COPILOT, "copilot", own).events.map((event) => event.name),
			["errorOccurred"],
		);
	});
});

describe("hookCommand", () => {
	it("runs a script through bash at the target's root, quoting arguments that need it", () => {
		assert.strictEqual(
			hookCommand({ script: "hooks/a.sh", args: ["--flag", "two words", "it's"] }, `\${PLUGIN_ROOT}`, "bash"),
			`bash "\${PLUGIN_ROOT}/hooks/a.sh" --flag 'two words' 'it'\\''s'`,
		);
	});

	it("single-quotes a path the shell would otherwise read, keeping the root expandable", () => {
		assert.strictEqual(
			hookCommand({ script: 'hooks/run $(id) `x` "q".sh' }, `\${PLUGIN_ROOT}`, "bash"),
			`bash "\${PLUGIN_ROOT}"/'hooks/run $(id) \`x\` "q".sh'`,
		);
		assert.strictEqual(
			hookCommand({ script: "hooks/it's.sh" }, `\${PLUGIN_ROOT}`, "exec"),
			`"\${PLUGIN_ROOT}"/'hooks/it'\\''s.sh'`,
		);
	});

	it("hookExec runs a script through bash, or as itself under exec, with no shell to quote for", () => {
		assert.deepStrictEqual(
			hookExec({ script: "hooks/run $(id).sh", args: ["--a b"] }, `\${CLAUDE_PLUGIN_ROOT}`, "bash"),
			{
				command: "bash",
				args: [`\${CLAUDE_PLUGIN_ROOT}/hooks/run $(id).sh`, "--a b"],
			},
		);
		assert.deepStrictEqual(hookExec({ script: "hooks/a.sh" }, `\${CLAUDE_PLUGIN_ROOT}`, "exec"), {
			command: `\${CLAUDE_PLUGIN_ROOT}/hooks/a.sh`,
			args: [],
		});
	});

	it("under exec, runs the script path itself", () => {
		assert.strictEqual(
			hookCommand({ script: "hooks/a.sh" }, `\${CLAUDE_PLUGIN_ROOT}`, "exec"),
			`"\${CLAUDE_PLUGIN_ROOT}/hooks/a.sh"`,
		);
	});

	it("spells the PLUGIN_ROOT placeholder in a command the target's way", () => {
		assert.strictEqual(
			hookCommand({ command: `bash "\${PLUGIN_ROOT}/x.sh"` }, `\${CLAUDE_PLUGIN_ROOT}`, "bash"),
			`bash "\${CLAUDE_PLUGIN_ROOT}/x.sh"`,
		);
	});
});

describe("renderHooks", () => {
	const hooked = config({ ...BASE, claude: true, copilot: true });

	it("claude: one matcher group per entry, a script in exec form, a command as written, timeout in seconds", () => {
		const text = renderHooks(CLAUDE, targetHooks(CLAUDE, "claude", hooked).events, "bash") ?? "";
		assert.deepStrictEqual(JSON.parse(text), {
			hooks: {
				SessionStart: [
					{
						hooks: [{ type: "command", command: "bash", args: [`\${CLAUDE_PLUGIN_ROOT}/hooks/start.sh`], timeout: 5 }],
					},
				],
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [{ type: "command", command: `bash "\${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh" --quiet` }],
					},
				],
			},
		});
	});

	it("copilot: version 1, the command under bash, timeoutSec", () => {
		const text = renderHooks(COPILOT, targetHooks(COPILOT, "copilot", hooked).events, "bash") ?? "";
		assert.deepStrictEqual(JSON.parse(text), {
			version: 1,
			hooks: {
				SessionStart: [
					{
						type: "command",
						bash: `bash "\${PLUGIN_ROOT}/hooks/start.sh"`,
						timeoutSec: 5,
						env: { PLUGINFINITY_EVENT: "SessionStart" },
					},
				],
				PreToolUse: [
					{
						type: "command",
						bash: `bash "\${PLUGIN_ROOT}/hooks/guard.sh" --quiet`,
						matcher: "Bash",
						env: { PLUGINFINITY_EVENT: "PreToolUse" },
					},
				],
			},
		});
	});

	it("no hooks renders no file", () => {
		assert.isUndefined(renderHooks(CLAUDE, [], "bash"));
	});
});
