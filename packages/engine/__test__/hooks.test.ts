import { assert, describe, it } from "@effect/vitest";
import { CLAUDE, COPILOT, PluginfinityConfig } from "@pluginfinity/targets";
import { Schema } from "effect";
import {
	BINARY_DISPATCH,
	entryEnv,
	eventHandlers,
	hookBinaries,
	hookCommand,
	hookExec,
	hookProblems,
	hookScripts,
	renderHooks,
	sessionStartMatcher,
	targetHooks,
} from "../src/hooks.js";

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
						hooks: [
							{
								type: "command",
								command: "env",
								args: ["PLUGINFINITY_EVENT=SessionStart", "bash", `\${CLAUDE_PLUGIN_ROOT}/hooks/start.sh`],
								timeout: 5,
							},
						],
					},
				],
				PreToolUse: [
					{
						matcher: "Bash",
						hooks: [
							{
								type: "command",
								command: `export PLUGINFINITY_EVENT='PreToolUse'; bash "\${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh" --quiet`,
							},
						],
					},
				],
			},
		});
	});

	it("Claude passes the event and fail policy through env, keeping the author's args in order", () => {
		const hooked = config({
			name: "x",
			description: "Fixture plugin.",
			claude: true,
			hooks: { PreToolUse: [{ script: "hooks/guard.sh", args: ["--a", "b c"], failClosed: true, matcher: "Bash" }] },
		});
		const json = JSON.parse(renderHooks(CLAUDE, targetHooks(CLAUDE, "claude", hooked).events, "bash") ?? "{}");
		assert.deepStrictEqual(json.hooks.PreToolUse[0].hooks[0], {
			type: "command",
			command: "env",
			args: [
				"PLUGINFINITY_EVENT=PreToolUse",
				"PLUGINFINITY_FAIL_CLOSED=1",
				"bash",
				"${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh",
				"--a",
				"b c",
			],
			onFailure: "block",
		});
	});

	it("a Claude command entry exports the event before the author's command", () => {
		const hooked = config({
			name: "x",
			description: "Fixture plugin.",
			claude: true,
			hooks: { Stop: [{ command: `node "\${PLUGIN_ROOT}/x.mjs" && echo done` }] },
		});
		const json = JSON.parse(renderHooks(CLAUDE, targetHooks(CLAUDE, "claude", hooked).events, "bash") ?? "{}");
		assert.strictEqual(
			json.hooks.Stop[0].hooks[0].command,
			`export PLUGINFINITY_EVENT='Stop'; node "\${CLAUDE_PLUGIN_ROOT}/x.mjs" && echo done`,
		);
	});

	it("Claude exec invoke puts the script path right after env pairs", () => {
		assert.deepStrictEqual(
			hookExec({ script: "hooks/a.sh" }, `\${CLAUDE_PLUGIN_ROOT}`, "exec", { PLUGINFINITY_EVENT: "Stop" }),
			{ command: "env", args: ["PLUGINFINITY_EVENT=Stop", `\${CLAUDE_PLUGIN_ROOT}/hooks/a.sh`] },
		);
	});

	it("entryEnv adds the matcher only when given", () => {
		assert.deepStrictEqual(entryEnv("Stop", { script: "a.sh" }), { PLUGINFINITY_EVENT: "Stop" });
		assert.deepStrictEqual(entryEnv("PreToolUse", { script: "a.sh", failClosed: true }, "Bash"), {
			PLUGINFINITY_EVENT: "PreToolUse",
			PLUGINFINITY_FAIL_CLOSED: "1",
			PLUGINFINITY_MATCHER: "Bash",
		});
	});

	it("a shell-form env value with an embedded quote is escaped", () => {
		assert.strictEqual(
			hookCommand({ command: "x" }, `\${CLAUDE_PLUGIN_ROOT}`, "bash", { PLUGINFINITY_MATCHER: "it's" }),
			`export PLUGINFINITY_MATCHER='it'\\''s'; x`,
		);
	});

	it("Copilot carries failClosed in its env field", () => {
		const hooked = config({
			name: "x",
			description: "Fixture plugin.",
			copilot: true,
			hooks: { PreToolUse: [{ script: "hooks/guard.sh", failClosed: true }] },
		});
		const json = JSON.parse(renderHooks(COPILOT, targetHooks(COPILOT, "copilot", hooked).events, "bash") ?? "{}");
		assert.deepStrictEqual(json.hooks.PreToolUse[0].env, {
			PLUGINFINITY_EVENT: "PreToolUse",
			PLUGINFINITY_FAIL_CLOSED: "1",
		});
		assert.strictEqual(json.hooks.PreToolUse[0].bash, 'bash "${PLUGIN_ROOT}/hooks/guard.sh"');
	});

	it("copilot: a matcher on an event the host ignores moves to PLUGINFINITY_MATCHER; other matchers stay", () => {
		const hooked = config({
			name: "x",
			description: "Fixture plugin.",
			copilot: true,
			hooks: {
				SessionStart: [{ matcher: "startup", script: "hooks/s.sh" }],
				PreToolUse: [{ matcher: "Bash", script: "hooks/g.sh" }],
			},
		});
		const json = JSON.parse(renderHooks(COPILOT, targetHooks(COPILOT, "copilot", hooked).events, "bash") ?? "{}");
		assert.notProperty(json.hooks.SessionStart[0], "matcher");
		assert.deepStrictEqual(json.hooks.SessionStart[0].env, {
			PLUGINFINITY_EVENT: "SessionStart",
			PLUGINFINITY_MATCHER: "startup|new",
		});
		assert.strictEqual(json.hooks.PreToolUse[0].matcher, "Bash");
		assert.deepStrictEqual(json.hooks.PreToolUse[0].env, { PLUGINFINITY_EVENT: "PreToolUse" });
	});

	it("claude: a SessionStart matcher stays a host matcher", () => {
		const hooked = config({
			name: "x",
			description: "Fixture plugin.",
			claude: true,
			hooks: { SessionStart: [{ matcher: "startup", script: "hooks/s.sh" }] },
		});
		const json = JSON.parse(renderHooks(CLAUDE, targetHooks(CLAUDE, "claude", hooked).events, "bash") ?? "{}");
		assert.strictEqual(json.hooks.SessionStart[0].matcher, "startup");
		assert.notInclude(JSON.stringify(json), "PLUGINFINITY_MATCHER");
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

describe("sessionStartMatcher", () => {
	it("adds new right after startup in an exact list", () => {
		assert.deepStrictEqual(sessionStartMatcher("startup"), { matcher: "startup|new", widened: true, unwidened: false });
		assert.strictEqual(sessionStartMatcher("startup|resume").matcher, "startup|new|resume");
		assert.strictEqual(sessionStartMatcher("resume|startup").matcher, "resume|startup|new");
	});

	it("reads a comma list as Claude does, and writes the widened list with bars", () => {
		assert.deepStrictEqual(sessionStartMatcher("startup, resume"), {
			matcher: "startup|new|resume",
			widened: true,
			unwidened: false,
		});
		assert.deepStrictEqual(sessionStartMatcher("resume, new,startup"), {
			matcher: "resume, new,startup",
			widened: false,
			unwidened: false,
		});
	});

	it("leaves a matcher that cannot or need not widen as written", () => {
		for (const matcher of ["", "*", "resume", "startup|new", "new", "startuppy"]) {
			assert.deepStrictEqual(sessionStartMatcher(matcher), { matcher, widened: false, unwidened: false }, matcher);
		}
	});

	it("leaves a regex as written and flags one that matches startup but not new", () => {
		assert.deepStrictEqual(sessionStartMatcher("^start.*"), { matcher: "^start.*", widened: false, unwidened: true });
		assert.deepStrictEqual(sessionStartMatcher("^(startup|new)$"), {
			matcher: "^(startup|new)$",
			widened: false,
			unwidened: false,
		});
		assert.isFalse(sessionStartMatcher("(").unwidened);
	});

	it("copilot passes the widened list, claude keeps the host matcher as written", () => {
		const hooked = config({
			name: "x",
			description: "Fixture plugin.",
			copilot: true,
			hooks: { SessionStart: [{ matcher: "startup|resume", script: "hooks/s.sh" }] },
		});
		const copilot = JSON.parse(renderHooks(COPILOT, targetHooks(COPILOT, "copilot", hooked).events, "bash") ?? "{}");
		assert.strictEqual(copilot.hooks.SessionStart[0].env.PLUGINFINITY_MATCHER, "startup|new|resume");
		const claude = JSON.parse(renderHooks(CLAUDE, targetHooks(CLAUDE, "claude", hooked).events, "bash") ?? "{}");
		assert.strictEqual(claude.hooks.SessionStart[0].matcher, "startup|resume");
	});
});

describe("failClosed and onFailure", () => {
	const claudeEntry = (event: string, entry: Record<string, unknown>) => {
		const hooked = config({ name: "x", description: "Fixture plugin.", claude: true, hooks: { [event]: [entry] } });
		return JSON.parse(renderHooks(CLAUDE, targetHooks(CLAUDE, "claude", hooked).events, "bash") ?? "{}").hooks[event][0]
			.hooks[0];
	};

	it("claude: a failClosed entry of any kind also blocks when the host cannot run it", () => {
		assert.strictEqual(claudeEntry("PreToolUse", { script: "hooks/g.sh", failClosed: true }).onFailure, "block");
		assert.strictEqual(claudeEntry("PreToolUse", { command: "x", failClosed: true }).onFailure, "block");
		assert.strictEqual(claudeEntry("PreToolUse", { binary: "hooks/bin/g", failClosed: true }).onFailure, "block");
		assert.notProperty(claudeEntry("PreToolUse", { script: "hooks/g.sh" }), "onFailure");
	});

	it("claude: no onFailure where the host ignores it, since Claude cannot repair a hook that will not run", () => {
		for (const event of ["Stop", "SubagentStop", "TaskCompleted", "TeammateIdle"]) {
			assert.notProperty(claudeEntry(event, { script: "hooks/g.sh", failClosed: true }), "onFailure", event);
		}
	});

	it("copilot: onFailure is not written", () => {
		const hooked = config({
			name: "x",
			description: "Fixture plugin.",
			copilot: true,
			hooks: { PreToolUse: [{ script: "hooks/g.sh", failClosed: true }] },
		});
		const json = JSON.parse(renderHooks(COPILOT, targetHooks(COPILOT, "copilot", hooked).events, "bash") ?? "{}");
		assert.notProperty(json.hooks.PreToolUse[0], "onFailure");
	});
});

describe("binary hooks", () => {
	const hooked = config({
		name: "x",
		description: "Fixture plugin.",
		claude: true,
		copilot: true,
		hooks: {
			PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/guard", args: ["--strict"], failClosed: true, timeout: 5 }],
			Stop: [{ script: "hooks/stop.sh" }],
		},
	});

	it("hookBinaries lists each binary prefix once and no script", () => {
		assert.deepStrictEqual(hookBinaries(targetHooks(CLAUDE, "claude", hooked).events), ["hooks/bin/guard"]);
		assert.deepStrictEqual(hookScripts(targetHooks(CLAUDE, "claude", hooked).events), ["hooks/stop.sh"]);
	});

	it("claude: a binary runs in exec form through the platform dispatch, told its host and plugin", () => {
		const facts = { host: "claude", plugin: "x" };
		const json = JSON.parse(renderHooks(CLAUDE, targetHooks(CLAUDE, "claude", hooked).events, "bash", facts) ?? "{}");
		assert.deepStrictEqual(json.hooks.PreToolUse[0], {
			matcher: "Bash",
			hooks: [
				{
					type: "command",
					command: "env",
					args: [
						"PLUGINFINITY_EVENT=PreToolUse",
						"PLUGINFINITY_FAIL_CLOSED=1",
						"PLUGINFINITY_HOST=claude",
						"PLUGINFINITY_PLUGIN=x",
						"sh",
						"-c",
						BINARY_DISPATCH,
						"${CLAUDE_PLUGIN_ROOT}/hooks/bin/guard",
						"${CLAUDE_PLUGIN_ROOT}",
						"--strict",
					],
					timeout: 5,
					onFailure: "block",
				},
			],
		});
		// A script entry beside it is rendered as before, with no host or plugin.
		assert.deepStrictEqual(json.hooks.Stop[0].hooks[0].args, [
			"PLUGINFINITY_EVENT=Stop",
			"bash",
			"${CLAUDE_PLUGIN_ROOT}/hooks/stop.sh",
		]);
	});

	it("copilot: a binary runs through the dispatch in the bash field, with the facts in env", () => {
		const facts = { host: "copilot", plugin: "x" };
		const json = JSON.parse(
			renderHooks(COPILOT, targetHooks(COPILOT, "copilot", hooked).events, "bash", facts) ?? "{}",
		);
		const entry = json.hooks[Object.keys(json.hooks)[0] ?? ""][0];
		assert.strictEqual(
			entry.bash,
			`sh -c '${BINARY_DISPATCH}' "\${PLUGIN_ROOT}/hooks/bin/guard" "\${PLUGIN_ROOT}" --strict`,
		);
		assert.deepStrictEqual(entry.env, {
			PLUGINFINITY_EVENT: "PreToolUse",
			PLUGINFINITY_FAIL_CLOSED: "1",
			PLUGINFINITY_HOST: "copilot",
			PLUGINFINITY_PLUGIN: "x",
		});
	});

	it("the dispatch picks the file for the machine, hands the program its plugin root, and holds no single quote", () => {
		assert.strictEqual(
			BINARY_DISPATCH,
			'r=$1; shift; s=$(uname -s); e=; case "$s" in MINGW*|MSYS*|CYGWIN*) s=Windows; e=.exe;; esac; b="$0-$s-$(uname -m)$e"; [ -x "$b" ] || exit "${PLUGINFINITY_FAIL_CLOSED:-0}"; PLUGINFINITY_ROOT="$r" exec "$b" "$@"',
		);
		assert.notInclude(BINARY_DISPATCH, "'");
	});

	it("an entry with both binary and script is rejected by the strict decode the loader uses", () => {
		assert.throws(() =>
			Schema.decodeUnknownSync(PluginfinityConfig)(
				{
					name: "x",
					description: "Fixture plugin.",
					claude: true,
					hooks: { Stop: [{ binary: "hooks/bin/a", script: "hooks/a.sh" }] },
				},
				{ onExcessProperty: "error" },
			),
		);
	});
});

describe("handler kinds and entry fields", () => {
	const facts = { host: "claude", plugin: "acme", description: "Does things.", servers: new Set(["db"]) };
	const claude = (hooks: Record<string, ReadonlyArray<Record<string, unknown>>>) =>
		JSON.parse(
			renderHooks(
				CLAUDE,
				targetHooks(CLAUDE, "claude", config({ name: "acme", description: "Does things.", claude: true, hooks }))
					.events,
				"bash",
				facts,
			) ?? "{}",
		);

	it("claude: the plugin's description heads the hooks file", () => {
		assert.strictEqual(claude({ Stop: [{ script: "hooks/s.sh" }] }).description, "Does things.");
	});

	it("claude: if, statusMessage, async and shell are written as given", () => {
		const json = claude({
			PreToolUse: [
				{ matcher: "Bash", script: "hooks/g.sh", if: "Bash(git *)", statusMessage: "Checking", timeout: 5 },
				{ command: "Write-Host hi", shell: "powershell", async: true },
			],
		});
		assert.deepStrictEqual(json.hooks.PreToolUse[0].hooks[0], {
			type: "command",
			command: "env",
			args: ["PLUGINFINITY_EVENT=PreToolUse", "bash", "${CLAUDE_PLUGIN_ROOT}/hooks/g.sh"],
			if: "Bash(git *)",
			timeout: 5,
			statusMessage: "Checking",
		});
		assert.deepStrictEqual(json.hooks.PreToolUse[1].hooks[0], {
			type: "command",
			command: "export PLUGINFINITY_EVENT='PreToolUse'; Write-Host hi",
			shell: "powershell",
			async: true,
		});
	});

	it("claude: asyncRewake is written, and the hook is told it may wake the agent", () => {
		const hook = claude({ PostToolUse: [{ script: "hooks/t.sh", asyncRewake: true }] }).hooks.PostToolUse[0].hooks[0];
		assert.strictEqual(hook.asyncRewake, true);
		assert.include(hook.args, "PLUGINFINITY_ASYNC_REWAKE=1");
		assert.notInclude(
			claude({ PostToolUse: [{ script: "hooks/t.sh" }] }).hooks.PostToolUse[0].hooks[0].args,
			"PLUGINFINITY_ASYNC_REWAKE=1",
		);
	});

	it("claude: an http, mcp tool, prompt and agent hook each take Claude Code's shape", () => {
		const json = claude({
			PreToolUse: [
				{
					matcher: "Bash",
					http: "http://localhost:8080/pre",
					headers: { Authorization: "Bearer $TOKEN" },
					allowedEnvVars: ["TOKEN"],
					timeout: 30,
					failClosed: true,
				},
				{ mcpTool: { server: "db", tool: "scan", input: { path: "${tool_input.file_path}" } } },
				{ mcpTool: { server: "elsewhere", tool: "scan" } },
			],
			Stop: [
				{ prompt: "Done? $ARGUMENTS", model: "haiku", continueOnBlock: true },
				{ agent: "Verify the tests pass. $ARGUMENTS", timeout: 120 },
			],
		});
		assert.deepStrictEqual(json.hooks.PreToolUse[0], {
			matcher: "Bash",
			hooks: [
				{
					type: "http",
					url: "http://localhost:8080/pre",
					headers: { Authorization: "Bearer $TOKEN" },
					allowedEnvVars: ["TOKEN"],
					timeout: 30,
					onFailure: "block",
				},
			],
		});
		// The plugin's own server takes the plugin's scope; another server's name is left alone.
		assert.deepStrictEqual(json.hooks.PreToolUse[1].hooks[0], {
			type: "mcp_tool",
			server: "plugin:acme:db",
			tool: "scan",
			input: { path: "${tool_input.file_path}" },
		});
		assert.strictEqual(json.hooks.PreToolUse[2].hooks[0].server, "elsewhere");
		assert.deepStrictEqual(json.hooks.Stop[0].hooks[0], {
			type: "prompt",
			prompt: "Done? $ARGUMENTS",
			model: "haiku",
			continueOnBlock: true,
		});
		assert.deepStrictEqual(json.hooks.Stop[1].hooks[0], {
			type: "agent",
			prompt: "Verify the tests pass. $ARGUMENTS",
			timeout: 120,
		});
	});

	it("copilot runs command hooks only: another kind fails unless it sets fallback omit, which leaves it out", () => {
		const hooked = config({
			name: "x",
			description: "Fixture plugin.",
			copilot: true,
			hooks: {
				PreToolUse: [{ script: "hooks/g.sh" }, { http: "http://localhost/x" }, { prompt: "ok?", fallback: "omit" }],
				Stop: [{ agent: "verify", fallback: "omit" }],
			},
		});
		const found = targetHooks(COPILOT, "copilot", hooked);
		assert.deepStrictEqual(found.unsupportedHandlers, [{ event: "PreToolUse", handler: "http" }]);
		assert.deepStrictEqual(found.omitted, ["PreToolUse (prompt)", "Stop (agent)"]);
		// Stop has nothing left to run, so it is not written at all.
		assert.deepStrictEqual(
			found.events.map((event) => [event.event, event.entries.length]),
			[["PreToolUse", 1]],
		);
		assert.deepStrictEqual(targetHooks(CLAUDE, "claude", hooked).unsupportedHandlers, []);
	});

	it("an event runs only the handler kinds Claude Code runs there", () => {
		assert.deepStrictEqual(eventHandlers("Setup"), ["command"]);
		assert.deepStrictEqual(eventHandlers("SessionStart"), ["command", "mcp_tool"]);
		assert.notInclude(eventHandlers("PermissionRequest"), "agent");
		assert.notInclude(eventHandlers("PreSkillShellCommand"), "prompt");
		assert.include(eventHandlers("Stop"), "agent");
	});

	it("hookProblems names what the host would ignore or never run", () => {
		const problems = (event: string, entry: Record<string, unknown>) =>
			hookProblems(
				event,
				config({ name: "x", description: "d", claude: true, hooks: { [event]: [entry] } }).hooks?.[event as "Stop"] ??
					[],
			).map((problem) => problem.key);
		assert.deepStrictEqual(problems("Stop", { script: "a.sh", if: "Bash(git *)" }), ["hooks.Stop[0].if"]);
		assert.deepStrictEqual(problems("PreToolUse", { script: "a.sh", if: "Bash(git *)" }), []);
		assert.deepStrictEqual(problems("SessionStart", { http: "http://x" }), ["hooks.SessionStart[0]"]);
		assert.deepStrictEqual(problems("PreSkillShellCommand", { prompt: "ok?" }), ["hooks.PreSkillShellCommand[0]"]);
		assert.deepStrictEqual(problems("PostToolUse", { script: "a.sh", async: true, failClosed: true }), [
			"hooks.PostToolUse[0].failClosed",
		]);
		assert.deepStrictEqual(problems("Stop", { prompt: "ok?", failClosed: true }), ["hooks.Stop[0].failClosed"]);
		assert.deepStrictEqual(problems("Stop", { prompt: "ok?" }), []);
	});

	it("a background or model hook gets no onFailure, since Claude Code would not read it", () => {
		const json = claude({ PostToolUse: [{ script: "hooks/t.sh", async: true }], Stop: [{ prompt: "ok?" }] });
		assert.notProperty(json.hooks.PostToolUse[0].hooks[0], "onFailure");
		assert.notProperty(json.hooks.Stop[0].hooks[0], "onFailure");
	});

	it("an entry that mixes two handlers is rejected by the strict decode the loader uses", () => {
		assert.throws(() =>
			Schema.decodeUnknownSync(PluginfinityConfig)(
				{ name: "x", description: "d", claude: true, hooks: { Stop: [{ prompt: "a", agent: "b" }] } },
				{ onExcessProperty: "error" },
			),
		);
	});
});
