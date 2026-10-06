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
			const scripts = join(plugin, "builds", host, "skills", "s", "scripts");
			mkdirSync(scripts, { recursive: true });
			writeFileSync(join(scripts, "cat.sh"), CAT);
		}
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
		writeFileSync(
			join(claude, "monitors", "monitors.json"),
			JSON.stringify([{ name: "m", command: 'bash "${CLAUDE_PLUGIN_ROOT}/monitors/m.sh"', description: "fixture" }]),
		);
		const result = spawnSync("bats", ["--tap", join(plugin, "__test__")], {
			env: { ...process.env, PLUGINFINITY_BATS_HELPER: HELPER },
			encoding: "utf8",
		});
		assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
	});
});
