import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { ENV_LIB_FILES } from "../src/env-lib.generated.js";
import { HOOK_LIB_FILES } from "../src/hook-lib.generated.js";
import { libFiles } from "../src/lib-files.js";
import { LOG_LIB_FILES } from "../src/log-lib.generated.js";
import { MONITOR_LIB_FILES } from "../src/monitor-lib.generated.js";
import { SERVER_LIB_FILES } from "../src/server-lib.generated.js";

const read = (dir: string) => {
	const source = fileURLToPath(new URL(`../${dir}/`, import.meta.url));
	return readdirSync(source)
		.filter((name) => name.endsWith(".sh"))
		.sort()
		.map((name) => ({ name, content: readFileSync(`${source}${name}`, "utf8") }));
};

describe("embedded hook library", () => {
	it("matches hook-lib/*.sh byte for byte; run `pnpm --filter @pluginfinity/engine hook-lib:embed` after editing them", () => {
		assert.deepStrictEqual(HOOK_LIB_FILES, read("hook-lib"));
	});
});

describe("embedded server library", () => {
	it("matches server-lib/*.sh byte for byte; run `pnpm --filter @pluginfinity/engine hook-lib:embed` after editing them", () => {
		assert.deepStrictEqual(SERVER_LIB_FILES, read("server-lib"));
	});
});

describe("embedded logging library", () => {
	it("matches log-lib/*.sh byte for byte; run `pnpm --filter @pluginfinity/engine hook-lib:embed` after editing them", () => {
		assert.deepStrictEqual(LOG_LIB_FILES, read("log-lib"));
	});
});

describe("embedded monitor library", () => {
	it("matches monitor-lib/*.sh byte for byte; run `pnpm --filter @pluginfinity/engine hook-lib:embed` after editing them", () => {
		assert.deepStrictEqual(MONITOR_LIB_FILES, read("monitor-lib"));
	});
});

describe("embedded session env library", () => {
	it("matches env-lib/*.sh byte for byte; run `pnpm --filter @pluginfinity/engine hook-lib:embed` after editing them", () => {
		assert.deepStrictEqual(ENV_LIB_FILES, read("env-lib"));
	});
});

describe("libFiles", () => {
	it("ships lib/pluginfinity/env.sh and env-run.sh only when env is declared", () => {
		const paths = (env: boolean) =>
			libFiles("claude", "fx", "0.0.0", { monitors: false, ...(env ? { env: { vars: { A: {} } } } : {}) }).map(
				(file) => file.path,
			);
		assert.includeMembers(paths(true), ["lib/pluginfinity/env.sh", "lib/pluginfinity/env-run.sh"]);
		assert.notInclude(paths(false), "lib/pluginfinity/env.sh");
		assert.notInclude(paths(false), "lib/pluginfinity/env-run.sh");
	});

	it("ships lib/pluginfinity/monitor.sh only when monitors is true", () => {
		const paths = (monitors: boolean) => libFiles("claude", "fx", "0.0.0", { monitors }).map((file) => file.path);
		assert.include(paths(true), "lib/pluginfinity/monitor.sh");
		assert.notInclude(paths(false), "lib/pluginfinity/monitor.sh");
	});
});
