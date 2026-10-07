import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";

const HELPER = fileURLToPath(new URL("../bats/pluginfinity.bash", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./fixtures/bats-helper/plugin dir", import.meta.url));
const LIB_SOURCE = fileURLToPath(new URL("../../engine/hook-lib/", import.meta.url));
const onPath = (command: string): boolean => spawnSync("sh", ["-c", `command -v ${command}`]).status === 0;

const STOP = `#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
[ "$(hook_input stop_hook_active)" = true ] && { hook_noop; exit 0; }
hook_block "stop on $(hook_host)"
`;

const CRASH = `#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_require_input
false
`;

const ENVHOOK = `#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
hook_noop
printf '%s|%s|%s\\n' "\${PLUGINFINITY_EVENT:-}" "\${PLUGINFINITY_FAIL_CLOSED:-}" "\${EXTRA:-}" >&2
`;

const SHOW = `#!/usr/bin/env bash
printf 'pwd=%s foo=%s args=%s\\n' "$PWD" "\${FOO:-}" "$*"
`;

const SHOWMON = `#!/usr/bin/env bash
printf 'pwd=%s project=%s root=%s plugin=%s session=%s ticks=%s\\n' "$PWD" "\${CLAUDE_PROJECT_DIR-unset}" "\${CLAUDE_PLUGIN_ROOT-unset}" "\${CLAUDE_PLUGIN_DATA-unset}" "\${CLAUDE_CODE_SESSION_ID-unset}" "\${PLUGINFINITY_MONITOR_MAX_TICKS-unset}"
`;

const PROJ = `#!/usr/bin/env bash
printf 'pwd=%s project=%s root=%s data=%s skill=%s envfile=%s session=%s plugin_root=%s args=%s\\n' "$PWD" "\${CLAUDE_PROJECT_DIR-unset}" "\${CLAUDE_PLUGIN_ROOT-unset}" "\${CLAUDE_PLUGIN_DATA-unset}" "\${CLAUDE_SKILL_DIR-unset}" "\${CLAUDE_ENV_FILE-unset}" "\${CLAUDE_CODE_SESSION_ID-unset}" "\${PLUGIN_ROOT-unset}" "$*"
`;

const VARS = `#!/usr/bin/env bash
printf 'a=%s b=%s c=%s d=%s\\n' "\${A_ONE-unset}" "\${B_TWO-unset}" "\${C_THREE-unset}" "\${D_FOUR-unset}"
`;

const CAT = "#!/usr/bin/env bash\ncat\necho done\n";
const MONITOR = `#!/usr/bin/env bash
_pf_lib_dir="$(dirname "$0")/../lib/pluginfinity"
. "$_pf_lib_dir/monitor.sh"
tick() { monitor_notify "first ${"$"}{GREETING:-hello}"; }
monitor_every 1 tick
`;

describe.skipIf(!onPath("bats") && process.env.CI === undefined)("the bats helper", () => {
	it("runs a built hook on both targets from a plugin dir with a space", { timeout: 60_000 }, () => {
		const plugin = join(mkdtempSync(join(tmpdir(), "pluginfinity bats ")), "plugin dir");
		cpSync(FIXTURE, plugin, { recursive: true });
		for (const host of ["claude", "copilot"]) {
			const lib = join(plugin, "builds", host, "hooks", "lib", "pluginfinity");
			mkdirSync(lib, { recursive: true });
			for (const name of readdirSync(LIB_SOURCE).filter((entry) => entry.endsWith(".sh"))) {
				writeFileSync(join(lib, name), readFileSync(join(LIB_SOURCE, name), "utf8"));
			}
			writeFileSync(join(lib, "host.sh"), `PLUGINFINITY_HOST=${host}\nPLUGINFINITY_PLUGIN='fixture'\n`);
			writeFileSync(join(plugin, "builds", host, "hooks", "stop.sh"), STOP);
			writeFileSync(join(plugin, "builds", host, "hooks", "crash.sh"), CRASH);
			writeFileSync(join(plugin, "builds", host, "hooks", "envhook.sh"), ENVHOOK);
			writeFileSync(join(plugin, "builds", host, "hooks", "cmdhook.sh"), ENVHOOK);
			writeFileSync(join(plugin, "builds", host, "hooks", "argshook.sh"), ENVHOOK);
			const scripts = join(plugin, "builds", host, "skills", "s", "scripts");
			mkdirSync(scripts, { recursive: true });
			writeFileSync(join(scripts, "cat.sh"), CAT);
			writeFileSync(join(scripts, "show.sh"), SHOW);
			writeFileSync(join(scripts, "proj.sh"), PROJ);
			writeFileSync(join(scripts, "vars.sh"), VARS);
			writeFileSync(join(plugin, "builds", host, "hooks", "startenv.sh"), ENVHOOK);
			mkdirSync(join(plugin, "builds", host, "servers"), { recursive: true });
			writeFileSync(join(plugin, "builds", host, "servers", "show.sh"), SHOW);
			writeFileSync(join(plugin, "builds", host, "servers", "proj.sh"), PROJ);
		}
		// The built hook entries each host runs, in the shapes the targets emit.
		const claudeEntry = (script: string, event: string, env: string[], matcher?: string) => ({
			...(matcher === undefined ? {} : { matcher }),
			hooks: [
				{
					type: "command",
					command: "env",
					args: [`PLUGINFINITY_EVENT=${event}`, ...env, "bash", `\${CLAUDE_PLUGIN_ROOT}/hooks/${script}`],
				},
			],
		});
		const copilotEntry = (script: string, event: string, env: Record<string, string>, matcher?: string) => ({
			type: "command",
			bash: `bash "\${PLUGIN_ROOT}/hooks/${script}"`,
			...(matcher === undefined ? {} : { matcher }),
			env: { PLUGINFINITY_EVENT: event, ...env },
		});
		mkdirSync(join(plugin, "builds", "claude", "hooks"), { recursive: true });
		writeFileSync(
			join(plugin, "builds", "claude", "hooks", "hooks.json"),
			JSON.stringify({
				hooks: {
					Stop: [claudeEntry("stop.sh", "Stop", [])],
					SessionStart: [
						claudeEntry("startenv.sh", "SessionStart", ["EXTRA=startup-a"], "startup"),
						claudeEntry("startenv.sh", "SessionStart", ["EXTRA=resume-b"], "resume"),
					],
					PreToolUse: [
						claudeEntry("crash.sh", "PreToolUse", ["PLUGINFINITY_FAIL_CLOSED=1"], "Bash"),
						claudeEntry("envhook.sh", "PreToolUse", ["PLUGINFINITY_FAIL_CLOSED=1", "EXTRA=bash-a"], "Bash"),
						claudeEntry("envhook.sh", "PreToolUse", ["EXTRA=read-b"], "Read"),
					],
					PostToolUse: [
						{
							matcher: "Bash",
							hooks: [
								{
									type: "command",
									command:
										"export PLUGINFINITY_EVENT='PostToolUse'; export EXTRA='it'\\''s a=b'; bash \"${CLAUDE_PLUGIN_ROOT}/hooks/cmdhook.sh\"",
								},
							],
						},
						{
							hooks: [
								{
									type: "command",
									command: "env",
									args: ["PLUGINFINITY_EVENT=PostToolUse", "${CLAUDE_PLUGIN_ROOT}/hooks/argshook.sh", "a=b"],
								},
							],
						},
					],
				},
			}),
		);
		mkdirSync(join(plugin, "builds", "copilot", "com.github.copilot", "hooks"), { recursive: true });
		writeFileSync(
			join(plugin, "builds", "copilot", "com.github.copilot", "hooks", "hooks.json"),
			JSON.stringify({
				version: 1,
				hooks: {
					Stop: [copilotEntry("stop.sh", "Stop", {})],
					// SessionStart entries carry the matcher in env, not in a `matcher` field.
					SessionStart: [
						copilotEntry("startenv.sh", "SessionStart", { EXTRA: "startup-a", PLUGINFINITY_MATCHER: "startup" }),
						copilotEntry("startenv.sh", "SessionStart", { EXTRA: "resume-b", PLUGINFINITY_MATCHER: "resume" }),
					],
					PreToolUse: [
						copilotEntry("crash.sh", "PreToolUse", { PLUGINFINITY_FAIL_CLOSED: "1" }, "Bash"),
						copilotEntry("envhook.sh", "PreToolUse", { PLUGINFINITY_FAIL_CLOSED: "1", EXTRA: "bash-a" }, "Bash"),
						copilotEntry("envhook.sh", "PreToolUse", { EXTRA: "read-b" }, "Read"),
					],
				},
			}),
		);
		// Every build carries the shared log library the hook library sources.
		const logLib = readFileSync(fileURLToPath(new URL("../../engine/log-lib/log.sh", import.meta.url)), "utf8");
		mkdirSync(join(plugin, "builds", "copilot", "lib", "pluginfinity"), { recursive: true });
		writeFileSync(join(plugin, "builds", "copilot", "lib", "pluginfinity", "log.sh"), logLib);
		const claude = join(plugin, "builds", "claude");
		const claudeLib = join(claude, "lib", "pluginfinity");
		mkdirSync(claudeLib, { recursive: true });
		mkdirSync(join(claude, "monitors"), { recursive: true });
		for (const name of ["log.sh", "monitor.sh"]) {
			const source = name === "log.sh" ? "log-lib" : "monitor-lib";
			writeFileSync(
				join(claudeLib, name),
				readFileSync(fileURLToPath(new URL(`../../engine/${source}/${name}`, import.meta.url)), "utf8"),
			);
		}
		writeFileSync(join(claude, "monitors", "m.sh"), MONITOR);
		writeFileSync(join(claude, "monitors", "show.sh"), SHOWMON);
		writeFileSync(
			join(claude, "monitors", "monitors.json"),
			JSON.stringify([
				{ name: "m", command: 'bash "${CLAUDE_PLUGIN_ROOT}/monitors/m.sh"', description: "fixture" },
				{ name: "show", command: 'bash "${CLAUDE_PLUGIN_ROOT}/monitors/show.sh"', description: "fixture" },
			]),
		);
		const result = spawnSync("bats", ["--tap", join(plugin, "__test__")], {
			env: { ...process.env, PLUGINFINITY_BATS_HELPER: HELPER },
			encoding: "utf8",
		});
		assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
	});
});
