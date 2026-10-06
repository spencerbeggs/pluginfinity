import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";

const SKILL = fileURLToPath(new URL("../../../plugins/pluginfinity/skills/migrating-hooks/SKILL.md", import.meta.url));

// Every helper plugin-bot's templates defined, and the variants consumer
// plugins added, must have a row in the mapping table.
const OLD_NAMES = [
	"emit_noop",
	"emit_allow",
	"emit_deny",
	"emit_context",
	"emit_block",
	"emit_system_message",
	"emit_raw",
	"emit_additional_context",
	"hook_error",
	"hook_debug",
	"HOOK_LOG_PREFIX",
	"source_session_env",
	"_gh",
	"_gh_auth_ok",
] as const;

describe("migrating-hooks mapping table", () => {
	const rows = readFileSync(SKILL, "utf8")
		.split("\n")
		.filter((line) => line.startsWith("| `"));
	for (const name of OLD_NAMES) {
		it(`has a row for ${name}`, () => {
			assert.isTrue(
				rows.some((row) => row.startsWith(`| \`${name}\``)),
				`no table row starting with \`${name}\``,
			);
		});
	}
});
