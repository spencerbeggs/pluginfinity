import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { HOOK_LIB_FILES } from "../src/hook-lib.generated.js";

const SOURCE = fileURLToPath(new URL("../hook-lib/", import.meta.url));

describe("embedded hook library", () => {
	it("matches hook-lib/*.sh byte for byte; run `pnpm --filter @pluginfinity/engine hook-lib:embed` after editing them", () => {
		const expected = readdirSync(SOURCE)
			.filter((name) => name.endsWith(".sh"))
			.sort()
			.map((name) => ({ name, content: readFileSync(`${SOURCE}${name}`, "utf8") }));
		assert.deepStrictEqual(HOOK_LIB_FILES, expected);
	});
});
