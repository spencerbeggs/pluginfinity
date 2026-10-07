import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_LIB = fileURLToPath(new URL("../../hook-lib/hook.sh", import.meta.url));
const LOG_LIB = fileURLToPath(new URL("../../log-lib/log.sh", import.meta.url));

/** The two output capabilities `hook_supports` answers for. */
export type OutputCapability = "context" | "system_message" | "env-shell";

/**
 * Asks the real `hook_supports` in `hook.sh` whether `host` honours each
 * capability on each event. The fake build root holds only `hook.sh`, `log.sh`
 * and a `host.sh` naming the host.
 *
 * @returns the events, per capability, for which the library answers yes
 */
export const supportedEvents = (
	host: string,
	events: ReadonlyArray<string>,
): Readonly<Record<OutputCapability, ReadonlyArray<string>>> => {
	const root = mkdtempSync(join(tmpdir(), "pf-supports-"));
	try {
		const lib = join(root, "hooks", "lib", "pluginfinity");
		mkdirSync(lib, { recursive: true });
		mkdirSync(join(root, "lib", "pluginfinity"), { recursive: true });
		cpSync(HOOK_LIB, join(lib, "hook.sh"));
		cpSync(LOG_LIB, join(root, "lib", "pluginfinity", "log.sh"));
		writeFileSync(
			join(lib, "host.sh"),
			`PLUGINFINITY_HOST=${host}\nPLUGINFINITY_PLUGIN=demo\nPLUGINFINITY_LIB_VERSION=0\n`,
		);
		const script = [
			`. '${join(lib, "hook.sh")}'`,
			`for cap in context system_message env-shell; do`,
			`  for ev in ${events.join(" ")}; do`,
			`    if hook_supports "$cap" "$ev"; then echo "$cap $ev"; fi`,
			`  done`,
			`done`,
		].join("\n");
		const out = execFileSync("bash", ["-c", script], {
			encoding: "utf8",
			input: "{}",
			env: { PATH: process.env.PATH ?? "", HOME: root },
		});
		const result: Record<OutputCapability, Array<string>> = { context: [], system_message: [], "env-shell": [] };
		for (const line of out.split("\n")) {
			const [cap, event] = line.split(" ");
			if ((cap === "context" || cap === "system_message" || cap === "env-shell") && event !== undefined)
				result[cap].push(event);
		}
		return result;
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};
