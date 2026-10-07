import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { MonitorEntry, Monitors } from "../src/index.js";
import { decodeStrict } from "./utils/decode.js";

const decodeEntry = decodeStrict(MonitorEntry);
const decodeMonitors = decodeStrict(Monitors);

describe("MonitorEntry", () => {
	it.effect("accepts a script monitor with args and a when", () =>
		Effect.gen(function* () {
			const entry = {
				script: "monitors/mail.sh",
				args: ["--quiet"],
				description: "Mail.",
				when: "on-skill-invoke:tsdoc",
			} as const;
			assert.deepStrictEqual(yield* decodeEntry(entry), entry);
		}),
	);

	it.effect("accepts a command monitor with when always", () =>
		Effect.gen(function* () {
			const entry = { command: `node "\${PLUGIN_ROOT}/m.mjs"`, description: "M.", when: "always" } as const;
			assert.deepStrictEqual(yield* decodeEntry(entry), entry);
		}),
	);

	const rejected: ReadonlyArray<readonly [string, unknown]> = [
		["both script and command", { script: "monitors/x.sh", command: "x", description: "X." }],
		["neither script nor command", { description: "X." }],
		["a missing description", { script: "monitors/x.sh" }],
		["an empty description", { script: "monitors/x.sh", description: "" }],
		["a bad when", { script: "monitors/x.sh", description: "X.", when: "sometimes" }],
		["an empty skill in when", { script: "monitors/x.sh", description: "X.", when: "on-skill-invoke:" }],
		["a qualified skill in when", { script: "monitors/x.sh", description: "X.", when: "on-skill-invoke:a:b" }],
		["a script outside the plugin", { script: "../x.sh", description: "X." }],
		["an unknown key", { script: "monitors/x.sh", description: "X.", timeout: 5 }],
	];
	for (const [name, input] of rejected) {
		it.effect(`rejects ${name}`, () =>
			Effect.gen(function* () {
				assert.isTrue((yield* Effect.exit(decodeEntry(input)))._tag === "Failure");
			}),
		);
	}
});

describe("Monitors", () => {
	it.effect("is keyed by kebab-case name", () =>
		Effect.gen(function* () {
			const ok = { "dogfood-mail": { script: "monitors/x.sh", description: "X." } };
			assert.deepStrictEqual(yield* decodeMonitors(ok), ok);
			const bad = yield* Effect.exit(decodeMonitors({ Mail_Box: { script: "monitors/x.sh", description: "X." } }));
			assert.strictEqual(bad._tag, "Failure");
		}),
	);
});
