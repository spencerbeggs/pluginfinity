import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_LIB = fileURLToPath(new URL("../../hook-lib/hook.sh", import.meta.url));
const LOG_LIB = fileURLToPath(new URL("../../log-lib/log.sh", import.meta.url));

/** The capabilities `hook_supports` is asked about. */
export type OutputCapability = "context" | "system_message" | "env-shell" | "block" | "deny";

const CAPABILITIES: ReadonlyArray<OutputCapability> = ["context", "system_message", "env-shell", "block", "deny"];

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
			`for cap in ${CAPABILITIES.join(" ")}; do`,
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
		const result: Record<OutputCapability, Array<string>> = {
			context: [],
			system_message: [],
			"env-shell": [],
			block: [],
			deny: [],
		};
		for (const line of out.split("\n")) {
			const [cap, event] = line.split(" ");
			const known = CAPABILITIES.find((one) => one === cap);
			if (known !== undefined && event !== undefined) result[known].push(event);
		}
		return result;
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

/** One helper call made on one event, and what the library printed for it. */
export interface HelperResponse {
	readonly event: string;
	readonly helper: string;
	/** The library's stdout: one JSON object, or empty when it sent nothing. */
	readonly output: string;
}

/**
 * Runs each helper call on each event through the real `hook.sh`, one process
 * per pair because the library sends one response per run, and returns what
 * each printed. `helpers` maps a label to the script line that follows the
 * library being sourced; the input is `{"hook_event_name": <event>}`.
 */
export const helperResponses = (
	host: string,
	events: ReadonlyArray<string>,
	helpers: Readonly<Record<string, string>>,
	env: Readonly<Record<string, string>> = {},
): ReadonlyArray<HelperResponse> => {
	const root = mkdtempSync(join(tmpdir(), "pf-responses-"));
	try {
		const lib = join(root, "hooks", "lib", "pluginfinity");
		mkdirSync(lib, { recursive: true });
		mkdirSync(join(root, "lib", "pluginfinity"), { recursive: true });
		mkdirSync(join(root, "out"));
		cpSync(HOOK_LIB, join(lib, "hook.sh"));
		cpSync(LOG_LIB, join(root, "lib", "pluginfinity", "log.sh"));
		writeFileSync(
			join(lib, "host.sh"),
			`PLUGINFINITY_HOST=${host}\nPLUGINFINITY_PLUGIN=demo\nPLUGINFINITY_LIB_VERSION=0\n`,
		);
		const labels = Object.keys(helpers);
		labels.forEach((label, index) => {
			writeFileSync(join(root, `helper-${index}.sh`), `. '${join(lib, "hook.sh")}'\n${helpers[label] ?? ""}\n`);
		});
		// The events run side by side; each helper's output lands in its own file.
		const driver = [
			`for ev in ${events.join(" ")}; do`,
			`  (`,
			`    for i in ${labels.map((_, index) => index).join(" ")}; do`,
			`      printf '{"hook_event_name":"%s"}' "$ev" | bash "${root}/helper-$i.sh" >"${root}/out/$ev.$i" 2>/dev/null`,
			`    done`,
			`  ) &`,
			`done`,
			`wait`,
		].join("\n");
		execFileSync("bash", ["-c", driver], {
			env: { PATH: process.env.PATH ?? "", HOME: root, XDG_STATE_HOME: join(root, "state"), ...env },
		});
		return events.flatMap((event) =>
			labels.map((helper, index) => ({
				event,
				helper,
				output: readFileSync(join(root, "out", `${event}.${index}`), "utf8").trim(),
			})),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};
