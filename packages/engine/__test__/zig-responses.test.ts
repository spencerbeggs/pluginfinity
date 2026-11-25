import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import type { ClaudeHookEvent } from "@pluginfinity/core";
import { CLAUDE_HOOK_EVENTS, HOOK_IO } from "@pluginfinity/core";
import { CLAUDE, COPILOT } from "@pluginfinity/targets";
import { Schema } from "effect";
import { afterAll, beforeAll } from "vitest";
import { renderFacts } from "../src/tool-map.js";

// The native hook library (zig/src/hook.zig) answers in the same shapes as the bash one. This
// builds a hook that sends whichever response it is asked for, runs it on every event, and
// checks each answer against that event's output schema. It needs `zig` on PATH and is skipped
// without it.

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const HAS_ZIG = spawnSync("zig", ["version"], { encoding: "utf8" }).status === 0;

const RESPONSES = [
	"noop",
	"deny",
	"allow",
	"allow, no reason",
	"allow, rewritten input",
	"ask",
	"context",
	"block",
	"system message",
] as const;

describe.skipIf(!HAS_ZIG)("the Zig hook library's responses on Claude Code against the hook event schemas", () => {
	let dir = "";
	let responder = "";
	let withRegex = "";

	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), "pf-zig-"));
		// `-Ddev` installs the test hook twice, in the mode `addHooks` ships: once as plugins get it by
		// default, and once with the opt-in regex engine. The first run fetches that engine.
		execFileSync("zig", ["build", "-Ddev", "--prefix", dir], { cwd: REPO, stdio: "pipe" });
		responder = join(dir, "bin", "responder");
		withRegex = join(dir, "bin", "responder-regex");
	}, 300_000);

	afterAll(() => {
		if (dir !== "") rmSync(dir, { recursive: true, force: true });
	});

	const run = (
		event: string,
		respond: string,
		env: Readonly<Record<string, string>> = {},
		input: Readonly<Record<string, unknown>> = {},
		binary: string = responder,
	) => {
		const result = spawnSync(binary, [], {
			input: JSON.stringify({ hook_event_name: event, respond, ...input }),
			encoding: "utf8",
			env: { PLUGINFINITY_HOST: "claude", PLUGINFINITY_PLUGIN: "demo", XDG_STATE_HOME: join(dir, "state"), ...env },
		});
		return { status: result.status, output: result.stdout.trim() };
	};
	const stderrOf = (event: string, respond: string, env: Readonly<Record<string, string>>) =>
		spawnSync(responder, [], {
			input: JSON.stringify({ hook_event_name: event, respond }),
			encoding: "utf8",
			env: { PLUGINFINITY_HOST: "claude", PLUGINFINITY_PLUGIN: "demo", XDG_STATE_HOME: join(dir, "state"), ...env },
		});
	const contextOf = (output: string): string => {
		const parsed = JSON.parse(output) as {
			hookSpecificOutput?: { additionalContext?: string };
			additionalContext?: string;
		};
		return parsed.hookSpecificOutput?.additionalContext ?? parsed.additionalContext ?? "";
	};
	/** A plugin root holding the facts file the build writes for a target. */
	const pluginRoot = (name: string, target: typeof CLAUDE, host: string) => {
		const root = join(dir, name);
		mkdirSync(join(root, "lib", "pluginfinity"), { recursive: true });
		writeFileSync(
			join(root, "lib", "pluginfinity", "facts.json"),
			renderFacts(
				target,
				host,
				{ host: "demo", claude: "demo" },
				["db"],
				{ skills: ["review"], agents: [], monitors: [] },
				{
					DEMO_COLOR: { default: "blue" },
					DEMO_SHAPE: {},
				},
			),
		);
		return root;
	};
	const logFile = (name: string) => join(dir, "state", "pluginfinity", "demo", name);
	const readLog = (name: string) => (existsSync(logFile(name)) ? readFileSync(logFile(name), "utf8") : "");
	const strict = (event: ClaudeHookEvent, value: unknown) =>
		Schema.decodeUnknownSync(HOOK_IO[event].output)(value, { onExcessProperty: "error", errors: "all" });
	const problem = (event: ClaudeHookEvent, respond: string, status: number | null, output: string): Array<string> => {
		if (status !== 0) return [`${event} / ${respond}: exit ${status}`];
		if (output === "") return [];
		try {
			strict(event, JSON.parse(output));
			return [];
		} catch (error) {
			return [`${event} / ${respond}: ${output} -> ${String(error).split("\n").slice(0, 3).join(" ")}`];
		}
	};

	it("every response on every event exits 0 with one answer that event's output schema accepts", () => {
		const problems: Array<string> = [];
		for (const event of CLAUDE_HOOK_EVENTS) {
			for (const respond of RESPONSES) {
				const { status, output } = run(event, respond);
				if (output === "") problems.push(`${event} / ${respond}: sent nothing`);
				problems.push(...problem(event, respond, status, output));
			}
		}
		assert.deepStrictEqual(problems, []);
		// The run reached the library: a deny on PreToolUse is a real decision, and a no-op on Stop.
		assert.include(run("PreToolUse", "deny").output, '"permissionDecision":"deny"');
		assert.strictEqual(run("Stop", "deny").output, "{}");
		assert.include(run("PreModelSwitch", "ask").output, '"hookEventName":"PreModelSwitch"');
		assert.include(run("PreSkillShellCommand", "deny").output, '"hookEventName":"PreSkillShellCommand"');
		assert.include(run("PreToolUse", "allow, rewritten input").output, '"updatedInput":{"command":"ls"}');
		assert.strictEqual(run("Stop", "system message").output, '{"systemMessage":"a message"}');
		assert.strictEqual(run("Notification", "system message").output, "{}");
	});

	it("a failing handler exits 0 and sends nothing, or under failClosed a response the schema accepts", () => {
		const problems: Array<string> = [];
		for (const event of CLAUDE_HOOK_EVENTS) {
			const open = run(event, "crash");
			if (open.status !== 0 || open.output !== "") problems.push(`${event} / crash: ${open.status} ${open.output}`);
			const closed = run(event, "crash", { PLUGINFINITY_FAIL_CLOSED: "1" });
			problems.push(...problem(event, "crash, failClosed", closed.status, closed.output));
		}
		assert.deepStrictEqual(problems, []);
		const closed = (event: string) => run(event, "crash", { PLUGINFINITY_FAIL_CLOSED: "1" }).output;
		assert.include(closed("PreToolUse"), '"permissionDecision":"deny"');
		assert.include(closed("UserPromptSubmit"), '"decision":"block"');
		assert.strictEqual(closed("TeammateIdle"), "");
		assert.strictEqual(closed("SessionStart"), "");
	});

	it("a panic follows the fail policy: a clean exit when open, a deny when closed, and a line in the error log", () => {
		const open = run("PreToolUse", "panic");
		assert.deepStrictEqual(open, { status: 0, output: "" });
		const closed = run("PreToolUse", "panic", { PLUGINFINITY_FAIL_CLOSED: "1" });
		assert.strictEqual(closed.status, 0);
		assert.doesNotThrow(() => strict("PreToolUse", JSON.parse(closed.output)));
		assert.include(closed.output, '"permissionDecision":"deny"');
		// Where a closed guard has nothing to send, the panic still ends cleanly.
		assert.deepStrictEqual(run("SessionStart", "panic", { PLUGINFINITY_FAIL_CLOSED: "1" }), { status: 0, output: "" });
		assert.match(
			readLog("error.log"),
			/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ \[claude\] hook\/responder: panicked during PreToolUse: index out of bounds/m,
		);
	});

	it("logs to the plugin's error log always, and to the debug log only when PLUGINFINITY_DEBUG=1", () => {
		run("Stop", "log");
		assert.include(readLog("error.log"), "hook/responder: a line for the error log");
		assert.notInclude(readLog("debug.log"), "a line for the debug log");
		run("Stop", "log", { PLUGINFINITY_DEBUG: "1" });
		assert.include(readLog("debug.log"), "hook/responder: a line for the debug log");
		assert.include(readLog("debug.log"), "outcome: {}");
		// A failed handler and a helper the host ignores each leave a trace.
		run("Stop", "crash");
		assert.include(readLog("error.log"), "failed during Stop: Crashed");
		run("Stop", "deny", { PLUGINFINITY_DEBUG: "1" });
		assert.include(readLog("debug.log"), "deny does nothing on claude for Stop");
	});

	it("applies the matcher a host ignores: a non-matching source ends quietly, a matching one runs", () => {
		const copilot = { PLUGINFINITY_HOST: "copilot", PLUGINFINITY_EVENT: "SessionStart" };
		const start = (matcher: string, source: string) =>
			run("SessionStart", "context", { ...copilot, PLUGINFINITY_MATCHER: matcher }, { source });
		assert.deepStrictEqual(start("startup|new", "resume"), { status: 0, output: "" });
		assert.include(start("startup|new", "new").output, "additionalContext");
		assert.include(start("startup, resume", "resume").output, "additionalContext");
		assert.include(start("", "resume").output, "additionalContext");
		// The matcher is read only on the events a host ignores it on.
		assert.include(
			run("PreToolUse", "deny", { PLUGINFINITY_HOST: "copilot", PLUGINFINITY_MATCHER: "Edit" }).output,
			"permissionDecision",
		);
		// Without the opt-in engine a regular expression cannot be applied: the hook runs and says so.
		assert.include(start("^start", "resume").output, "additionalContext");
		assert.include(
			readLog("error.log"),
			"matcher ^start is a regular expression, and these hooks were built without regex support",
		);
	});

	it("with the opt-in engine, applies a regular-expression matcher as Claude Code would", () => {
		const start = (matcher: string, source: string) =>
			run(
				"SessionStart",
				"context",
				{ PLUGINFINITY_HOST: "copilot", PLUGINFINITY_EVENT: "SessionStart", PLUGINFINITY_MATCHER: matcher },
				{ source },
				withRegex,
			);
		assert.deepStrictEqual(start("^start", "resume"), { status: 0, output: "" });
		assert.include(start("^start", "startup").output, "additionalContext");
		assert.include(start("^(startup|new)$", "new").output, "additionalContext");
		assert.deepStrictEqual(start("^(startup|new)$", "newer"), { status: 0, output: "" });
		// Unanchored, like RegExp.prototype.test. (A bare word such as "sum" is an exact list, not a regex.)
		assert.include(start("sum.", "resume").output, "additionalContext");
		assert.deepStrictEqual(start("sum", "resume"), { status: 0, output: "" });
		// A pattern the engine refuses never skips the hook: it runs, and the log names the reason.
		assert.include(start("^(?!startup).*$", "startup").output, "additionalContext");
		assert.include(
			readLog("error.log"),
			"matcher ^(?!startup).*$ could not be applied (UnsupportedLookaround); the hook ran",
		);
		// Exact lists still take the list path.
		assert.deepStrictEqual(start("startup|new", "resume"), { status: 0, output: "" });
	});

	it("raw sends its response on the named host only", () => {
		assert.strictEqual(run("Stop", "raw").output, '{"systemMessage":"raw"}');
		assert.deepStrictEqual(run("Stop", "raw", { PLUGINFINITY_HOST: "copilot" }), { status: 0, output: "" });
	});

	it("finds the project from the input's cwd, walking up to .git, and can change into it", () => {
		const project = realpathSync(mkdtempSync(join(tmpdir(), "pf-zig-project-")));
		try {
			mkdirSync(join(project, ".git"));
			mkdirSync(join(project, "packages", "a"), { recursive: true });
			const inside = join(project, "packages", "a");
			assert.strictEqual(contextOf(run("SessionStart", "project dir", {}, { cwd: inside }).output), project);
			assert.strictEqual(contextOf(run("SessionStart", "cd project", {}, { cwd: inside }).output), project);
			// With no cwd in the input, Claude Code's project directory is the answer.
			assert.strictEqual(
				contextOf(run("SessionStart", "project dir", { CLAUDE_PROJECT_DIR: project }).output),
				project,
			);
			// The session's project stays CLAUDE_PROJECT_DIR even when the call runs elsewhere.
			assert.strictEqual(
				contextOf(
					run("SessionStart", "session dir", { CLAUDE_PROJECT_DIR: "/somewhere/else" }, { cwd: inside }).output,
				),
				"/somewhere/else",
			);
			// A directory that cannot be entered is an error, which fails open.
			assert.deepStrictEqual(run("SessionStart", "cd project", {}, { cwd: "/no/such/place" }), {
				status: 0,
				output: "",
			});
		} finally {
			rmSync(project, { recursive: true, force: true });
		}
	});

	it("runs a program in the project with its output captured, and reads files", () => {
		const project = realpathSync(mkdtempSync(join(tmpdir(), "pf-zig-exec-")));
		try {
			mkdirSync(join(project, ".git"));
			writeFileSync(join(project, "note.txt"), "hello");
			const ask = (respond: string, input: Readonly<Record<string, unknown>>) =>
				run("SessionStart", respond, {}, { cwd: project, ...input });
			// The program runs in the project; its stdout never becomes the hook's response.
			assert.strictEqual(
				contextOf(ask("exec", { script: "pwd; echo warn >&2; exit 3" }).output),
				`3|${project}|warn\n|false`,
			);
			assert.strictEqual(contextOf(ask("exec", { script: "cat note.txt" }).output), "0|hello||true");
			assert.strictEqual(contextOf(ask("exists", { path: join(project, "note.txt") }).output), "yes");
			assert.strictEqual(contextOf(ask("exists", { path: join(project, "missing") }).output), "no");
			assert.strictEqual(contextOf(ask("read file", { path: join(project, "note.txt") }).output), "hello");
			assert.strictEqual(contextOf(ask("read file", { path: join(project, "missing") }).output), "unreadable");
		} finally {
			rmSync(project, { recursive: true, force: true });
		}
	});

	it("reads the facts the build writes: tool names per host, shipped components and server prefixes", () => {
		const claude = { PLUGINFINITY_ROOT: pluginRoot("root-claude", CLAUDE, "claude") };
		const copilot = {
			PLUGINFINITY_HOST: "copilot",
			PLUGINFINITY_EVENT: "SessionStart",
			PLUGINFINITY_ROOT: pluginRoot("root-copilot", COPILOT, "copilot"),
		};
		const ask = (env: Readonly<Record<string, string>>, respond: string, input: Readonly<Record<string, unknown>>) =>
			contextOf(run("SessionStart", respond, env, input).output);
		assert.strictEqual(ask(claude, "tool name", { tool: "Read" }), "Read");
		assert.strictEqual(ask(copilot, "tool name", { tool: "Read" }), "view");
		assert.strictEqual(ask(copilot, "tool name", { tool: "TodoWrite" }), "none");
		assert.strictEqual(ask(claude, "tool prefix", { server: "db" }), "mcp__plugin_demo_db__");
		assert.strictEqual(ask(copilot, "tool prefix", { server: "db" }), "db-");
		assert.strictEqual(ask(copilot, "tool name", { tool: "mcp__plugin_demo_db__query" }), "db-query");
		assert.strictEqual(ask(claude, "has skill", { name: "review" }), "yes");
		assert.strictEqual(ask(claude, "has skill", { name: "missing" }), "no");
	});

	describe("session env", () => {
		const DOGFOOD_LIB = join(REPO, "plugins", "dogfood", "builds", "claude", "lib", "pluginfinity");
		const PLUGIN = "pluginfinity-dogfood";
		const NAMES = ["PFDOG_COLOR", "PFDOG_SHAPE", "PFDOG_LEVEL"] as const;
		let n = 0;

		/** A fresh state directory and project, and the two libraries reading them. */
		const world = () => {
			n += 1;
			const base = join(dir, `env-${n}`);
			const state = join(base, "state");
			const project = join(base, "project");
			mkdirSync(join(project, ".git"), { recursive: true });
			mkdirSync(state, { recursive: true });
			const root = join(base, "root");
			mkdirSync(join(root, "lib", "pluginfinity"), { recursive: true });
			writeFileSync(
				join(root, "lib", "pluginfinity", "facts.json"),
				renderFacts(
					CLAUDE,
					"claude",
					{ host: PLUGIN, claude: PLUGIN },
					[],
					{ skills: [], agents: [], monitors: [] },
					{
						PFDOG_COLOR: { default: "blue" },
						PFDOG_SHAPE: { default: "circle" },
						PFDOG_LEVEL: { default: "1" },
					},
				),
			);
			const physical = realpathSync(project);
			const session = (id: string) => join(state, "pluginfinity", PLUGIN, "session", id);
			const base_env = { XDG_STATE_HOME: state, PLUGINFINITY_PLUGIN: PLUGIN, PLUGINFINITY_ROOT: root };
			/** The Zig library's value of each declared name. */
			const zig = (
				event: string,
				input: Readonly<Record<string, unknown>>,
				env: Readonly<Record<string, string>> = {},
			): ReadonlyArray<string> =>
				NAMES.map((name) => {
					const result = spawnSync(responder, [], {
						input: JSON.stringify({ hook_event_name: event, respond: "env", name, ...input }),
						encoding: "utf8",
						env: { PLUGINFINITY_HOST: "claude", ...base_env, ...env },
					});
					return contextOf(result.stdout.trim());
				});
			/** The bash library's value of each declared name, from the dogfood plugin's built env.sh. */
			const bash = (
				event: string,
				sid: string,
				proj: string,
				env: Readonly<Record<string, string>> = {},
			): ReadonlyArray<string> => {
				const script = [
					`_pf_lib_dir='${DOGFOOD_LIB}'; _pf_env_manual=1; . "$_pf_lib_dir/env.sh"`,
					`env_load "$1" "$2"`,
					...NAMES.map((name) => `printf '%s\\n' "\${${name}-}"`),
				].join("\n");
				const out = execFileSync("sh", ["-c", script, "sh", sid, proj], {
					encoding: "utf8",
					env: { PATH: process.env.PATH ?? "", HOME: base, PLUGINFINITY_EVENT: event, ...base_env, ...env },
				});
				return out.split("\n").slice(0, NAMES.length);
			};
			/** Mark the runner as finished, so a SessionStart reader does not wait for it. */
			const done = (id: string) => {
				mkdirSync(session(id), { recursive: true });
				writeFileSync(join(session(id), "done"), "");
			};
			return { base, state, project: physical, session, zig, bash, done, base_env };
		};

		it("resolves live as the bash library does: default, .env, .env.local, then the process environment", () => {
			const w = world();
			w.done("s1");
			writeFileSync(join(w.project, ".env"), 'PFDOG_COLOR="from env"\nexport PFDOG_SHAPE=square\nUNDECLARED=x\n');
			writeFileSync(join(w.project, ".env.local"), "PFDOG_SHAPE='local shape'\n");
			const ambient = { PFDOG_LEVEL: "9" };
			const expected = ["from env", "local shape", "9"];
			assert.deepStrictEqual(w.zig("Stop", { session_id: "s1", cwd: w.project }, ambient), expected);
			assert.deepStrictEqual(w.bash("Stop", "s1", w.project, ambient), expected);
			// From a subdirectory the project is still the directory holding .git.
			mkdirSync(join(w.project, "pkg"));
			assert.deepStrictEqual(w.zig("Stop", { session_id: "s1", cwd: join(w.project, "pkg") }, ambient), expected);
		});

		it("takes the session's recorded values as authoritative, and resolves live only a name they lack", () => {
			const w = world();
			mkdirSync(w.session("s2"), { recursive: true });
			writeFileSync(join(w.session("s2"), "env"), "PFDOG_COLOR=recorded\nPFDOG_SHAPE=\n");
			writeFileSync(join(w.project, ".env"), "PFDOG_COLOR=dotenv\nPFDOG_LEVEL=5\n");
			const ambient = { PFDOG_COLOR: "ambient", PFDOG_SHAPE: "ambient" };
			// COLOR and SHAPE come from the file (an empty value included); LEVEL, which it lacks, from .env.
			const expected = ["recorded", "", "5"];
			assert.deepStrictEqual(w.zig("Stop", { session_id: "s2", cwd: w.project }, ambient), expected);
			assert.deepStrictEqual(w.bash("Stop", "s2", w.project, ambient), expected);
		});

		it("with no session id in the input, finds the session as the bash library does", () => {
			const w = world();
			mkdirSync(w.session("mine"), { recursive: true });
			writeFileSync(join(w.session("mine"), "env"), "PFDOG_COLOR=mine\nPFDOG_SHAPE=s\nPFDOG_LEVEL=1\n");
			mkdirSync(w.session("latest"), { recursive: true });
			writeFileSync(join(w.session("latest"), "env"), "PFDOG_COLOR=latest\nPFDOG_SHAPE=s\nPFDOG_LEVEL=1\n");
			// Claude Code's own session variable names the session when its values file exists.
			const own = { CLAUDE_CODE_SESSION_ID: "mine", CLAUDE_PROJECT_DIR: w.project };
			assert.strictEqual(w.zig("Stop", {}, own)[0], "mine");
			assert.strictEqual(w.bash("Stop", "", "", own)[0], "mine");
			// Otherwise the project's pointer does, named by cksum of the directory.
			const key = execFileSync("sh", ["-c", `printf '%s' "$1" | cksum | awk '{ print $1 "-" $2 }'`, "sh", w.project], {
				encoding: "utf8",
			}).trim();
			mkdirSync(join(w.state, "pluginfinity", PLUGIN, "project"), { recursive: true });
			writeFileSync(join(w.state, "pluginfinity", PLUGIN, "project", key), `latest\n${w.project}\n`);
			const none = { CLAUDE_PROJECT_DIR: w.project };
			assert.strictEqual(w.zig("Stop", {}, none)[0], "latest");
			assert.strictEqual(w.bash("Stop", "", "", none)[0], "latest");
			assert.strictEqual(w.zig("Stop", {}, { ...none, CLAUDE_CODE_SESSION_ID: "no-such-session" })[0], "latest");
		});

		it("on Copilot reads no .env without an absolute cwd, since hooks run from the plugin root", () => {
			const w = world();
			writeFileSync(join(w.project, ".env"), "PFDOG_COLOR=dotenv\n");
			// Ask through PostToolUse, an event whose context Copilot takes.
			const ask = (input: Readonly<Record<string, unknown>>) => {
				const result = spawnSync(responder, [], {
					input: JSON.stringify({ respond: "env", name: "PFDOG_COLOR", sessionId: "c1", ...input }),
					encoding: "utf8",
					cwd: w.project,
					env: { ...w.base_env, PLUGINFINITY_HOST: "copilot", PLUGINFINITY_EVENT: "PostToolUse" },
				});
				return contextOf(result.stdout.trim());
			};
			assert.strictEqual(ask({}), "blue");
			assert.strictEqual(ask({ cwd: w.project }), "dotenv");
		});

		it("at SessionStart waits for the env runner, up to 3 seconds, and only there", () => {
			const w = world();
			const timed = (event: string) => {
				const started = Date.now();
				w.zig(event, { session_id: "slow", cwd: w.project }).slice(0, 1);
				return Date.now() - started;
			};
			// Three reads, one process each: fast on any other event, three waits at SessionStart.
			assert.isBelow(timed("Stop"), 2000);
			assert.isAbove(timed("SessionStart"), 8000);
			assert.include(
				readFileSync(join(w.state, "pluginfinity", PLUGIN, "error.log"), "utf8"),
				"the env runner had not finished after 3s; resolving live",
			);
			w.done("slow");
			assert.isBelow(timed("SessionStart"), 2000);
		}, 60_000);

		it("envSet writes what the bash library reads, and reads what the bash library sets", () => {
			const w = world();
			w.done("s3");
			const envFile = join(w.base, "claude-env");
			writeFileSync(envFile, "");
			const set = (name: string, value: string, event = "SessionStart") =>
				spawnSync(responder, [], {
					input: JSON.stringify({
						hook_event_name: event,
						respond: "env set",
						name,
						value,
						session_id: "s3",
						cwd: w.project,
					}),
					encoding: "utf8",
					env: { PLUGINFINITY_HOST: "claude", CLAUDE_ENV_FILE: envFile, ...w.base_env },
				});
			set("PFDOG_COLOR", "it's red");
			// Every declared name is written, in declaration order, as the bash library writes them.
			assert.strictEqual(
				readFileSync(join(w.session("s3"), "env"), "utf8"),
				"PFDOG_COLOR=it's red\nPFDOG_SHAPE=circle\nPFDOG_LEVEL=1\n",
			);
			assert.strictEqual(readFileSync(join(w.session("s3"), "set"), "utf8"), "PFDOG_COLOR\n");
			assert.strictEqual(readFileSync(envFile, "utf8"), "export PFDOG_COLOR='it'\\''s red'\n");
			assert.isFalse(existsSync(join(w.session("s3"), "lock")), "the lock is released");
			assert.deepStrictEqual(w.bash("Stop", "s3", w.project), ["it's red", "circle", "1"]);

			// The bash library sets a name; the Zig library reads it, and keeps it when it sets another.
			execFileSync(
				"sh",
				[
					"-c",
					`_pf_lib_dir='${DOGFOOD_LIB}'; _pf_env_manual=1; . "$_pf_lib_dir/env.sh"; env_load s3 "$1"; _pf_env_set PFDOG_SHAPE oval`,
					"sh",
					w.project,
				],
				{ env: { PATH: process.env.PATH ?? "", HOME: w.base, PLUGINFINITY_HOST: "claude", ...w.base_env } },
			);
			assert.deepStrictEqual(w.zig("Stop", { session_id: "s3", cwd: w.project }), ["it's red", "oval", "1"]);
			set("PFDOG_LEVEL", "7");
			assert.deepStrictEqual(w.bash("Stop", "s3", w.project), ["it's red", "oval", "7"]);
			assert.strictEqual(readFileSync(join(w.session("s3"), "set"), "utf8"), "PFDOG_COLOR\nPFDOG_SHAPE\nPFDOG_LEVEL\n");

			// A refusal changes nothing: an undeclared name, an event that cannot produce a value, a newline.
			const before = readFileSync(join(w.session("s3"), "env"), "utf8");
			set("PATH", "/x");
			set("PFDOG_LEVEL", "8", "Stop");
			set("PFDOG_LEVEL", "a\nb");
			assert.strictEqual(readFileSync(join(w.session("s3"), "env"), "utf8"), before);
			const log = readFileSync(join(w.state, "pluginfinity", PLUGIN, "error.log"), "utf8");
			assert.include(log, "cannot set PATH: not a declared session variable");
			assert.include(log, "cannot set PFDOG_LEVEL: the value holds a newline");
		});

		it("takes over a stale lock, and writes anyway past one that will not clear", () => {
			const w = world();
			w.done("s4");
			const lock = join(w.session("s4"), "lock");
			mkdirSync(lock, { recursive: true });
			writeFileSync(join(lock, "at"), `${Math.floor(Date.now() / 1000) - 60}\n`);
			const set = () =>
				spawnSync(responder, [], {
					input: JSON.stringify({
						hook_event_name: "SessionStart",
						respond: "env set",
						name: "PFDOG_LEVEL",
						value: "2",
						session_id: "s4",
						cwd: w.project,
					}),
					encoding: "utf8",
					env: { PLUGINFINITY_HOST: "claude", PLUGINFINITY_DEBUG: "1", ...w.base_env },
				});
			const started = Date.now();
			set();
			assert.isBelow(Date.now() - started, 3000, "a lock a minute old is removed at once");
			assert.include(readFileSync(join(w.session("s4"), "env"), "utf8"), "PFDOG_LEVEL=2\n");
			assert.isFalse(existsSync(lock));
		}, 30_000);
	});

	it("reads an event as its generated type and relays a Claude-shaped response", () => {
		const input = { tool_name: "Bash", tool_use_id: "t1", tool_input: { command: "ls -la" } };
		assert.strictEqual(contextOf(run("PreToolUse", "typed", {}, input).output), "Bash: ls -la");
		const relayed = run(
			"PreToolUse",
			"relay",
			{ PLUGINFINITY_HOST: "copilot" },
			{
				response: JSON.stringify({
					hookSpecificOutput: { permissionDecision: "allow", updatedInput: { command: "ls" } },
				}),
			},
		);
		assert.deepStrictEqual(JSON.parse(relayed.output), {
			permissionDecision: "allow",
			modifiedArgs: { command: "ls" },
		});
	});

	it("wakes the agent with exit 2 and its message on stderr, only where the entry sets asyncRewake", () => {
		const waking = stderrOf("PostToolUse", "rewake", { PLUGINFINITY_ASYNC_REWAKE: "1" });
		assert.deepStrictEqual([waking.status, waking.stdout, waking.stderr], [2, "", "the tests failed\n"]);
		const plain = stderrOf("PostToolUse", "rewake", {});
		assert.deepStrictEqual([plain.status, plain.stdout, plain.stderr], [0, "", ""]);
		assert.include(readLog("error.log"), "rewake: this entry does not set asyncRewake; ignored");
	});

	it("agrees with the bash library on which events take a deny, a block and context", () => {
		const takes = (respond: string) => CLAUDE_HOOK_EVENTS.filter((event) => run(event, respond).output !== "{}").sort();
		const schema = (event: ClaudeHookEvent) =>
			(Schema.toJsonSchemaDocument(HOOK_IO[event].output).schema as { properties: Record<string, never> }).properties;
		const specific = (event: ClaudeHookEvent): Record<string, { enum?: ReadonlyArray<string> }> =>
			(schema(event).hookSpecificOutput as { properties?: Record<string, never> } | undefined)?.properties ?? {};
		assert.deepStrictEqual(
			takes("context"),
			CLAUDE_HOOK_EVENTS.filter((event) => "additionalContext" in specific(event)).sort(),
		);
		assert.deepStrictEqual(
			takes("deny"),
			CLAUDE_HOOK_EVENTS.filter((event) => specific(event).permissionDecision?.enum?.includes("deny") === true).sort(),
		);
		assert.deepStrictEqual(takes("block").length, 15);
	});
});
