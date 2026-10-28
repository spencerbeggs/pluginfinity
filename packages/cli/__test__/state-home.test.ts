import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { stateHomeFor } from "./utils/state-home.js";

// The CLI reads logs where log.sh writes them:
// ${XDG_STATE_HOME:-${HOME:-/nonexistent}/.local/state}.
describe("the CLI state directory", () => {
	it.effect("an empty HOME is /nonexistent, as log.sh reads it, never the OS home", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* stateHomeFor({ HOME: "" }), "/nonexistent/.local/state");
		}),
	);

	it.effect("an unset HOME is /nonexistent", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* stateHomeFor({}), "/nonexistent/.local/state");
		}),
	);

	it.effect("with HOME set and no XDG_STATE_HOME, the state directory is under HOME", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* stateHomeFor({ HOME: "/home/u" }), "/home/u/.local/state");
		}),
	);

	it.effect("an empty XDG_STATE_HOME counts as unset", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* stateHomeFor({ HOME: "/home/u", XDG_STATE_HOME: "" }), "/home/u/.local/state");
		}),
	);

	it.effect("a relative XDG_STATE_HOME is kept as given", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* stateHomeFor({ HOME: "/home/u", XDG_STATE_HOME: "state" }), "state");
		}),
	);

	it.effect("an absolute XDG_STATE_HOME wins even with no HOME", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* stateHomeFor({ HOME: "", XDG_STATE_HOME: "/var/s" }), "/var/s");
		}),
	);
});
