import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { HOOK_LIB_FILES } from "../../engine/src/hook-lib.generated.js";

const HELPER = fileURLToPath(new URL("../bats/pluginfinity.bash", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./fixtures/bats-helper/plugin dir", import.meta.url));
const onPath = (command: string): boolean => spawnSync("sh", ["-c", `command -v ${command}`]).status === 0;

const STOP = `#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/pluginfinity/hook.sh"
[ "$(hook_input stop_hook_active)" = true ] && { hook_noop; exit 0; }
hook_block "stop on $(hook_host)"
`;

describe.skipIf(!onPath("bats") && process.env.CI === undefined)("the bats helper", () => {
	it("runs a built hook on both targets from a plugin dir with a space", { timeout: 60_000 }, () => {
		const plugin = join(mkdtempSync(join(tmpdir(), "pluginfinity bats ")), "plugin dir");
		cpSync(FIXTURE, plugin, { recursive: true });
		for (const host of ["claude", "copilot"]) {
			const lib = join(plugin, "builds", host, "hooks", "lib", "pluginfinity");
			mkdirSync(lib, { recursive: true });
			for (const file of HOOK_LIB_FILES) writeFileSync(join(lib, file.name), file.content);
			writeFileSync(join(lib, "host.sh"), `PLUGINFINITY_HOST=${host}\nPLUGINFINITY_PLUGIN='fixture'\n`);
			writeFileSync(join(plugin, "builds", host, "hooks", "stop.sh"), STOP);
		}
		const result = spawnSync("bats", ["--tap", join(plugin, "__test__")], {
			env: { ...process.env, PLUGINFINITY_BATS_HELPER: HELPER },
			encoding: "utf8",
		});
		assert.strictEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
	});
});
