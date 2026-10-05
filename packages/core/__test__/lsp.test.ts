import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { LSP_FIELDS, LspServers } from "../src/index.js";
import { decodeStrict } from "./utils/decode.js";

const decode = decodeStrict(LspServers);

describe("LspServers", () => {
	it.effect("accepts Claude Code's LSP server shape", () =>
		Effect.gen(function* () {
			const input = {
				okfit: {
					command: "sh",
					args: [`\${PLUGIN_ROOT}/bin/start-lsp.sh`, "--stdio"],
					extensionToLanguage: { ".md": "markdown" },
					env: { MODE: "x" },
					initializationOptions: { a: 1 },
					settings: { b: true },
					workspaceFolder: `\${PLUGIN_ROOT}`,
					startupTimeout: 1000,
					shutdownTimeout: 1000,
					restartOnCrash: false,
					maxRestarts: 2,
					diagnostics: true,
				},
			};
			assert.deepStrictEqual(yield* decode(input), input);
		}),
	);

	const rejected: ReadonlyArray<readonly [string, unknown]> = [
		["a server without extensionToLanguage", { x: { command: "sh" } }],
		["an extension key without a leading dot", { x: { command: "sh", extensionToLanguage: { md: "markdown" } } }],
		[
			"transport, which pluginfinity does not model",
			{ x: { command: "sh", extensionToLanguage: { ".md": "markdown" }, transport: "stdio" } },
		],
		[
			"a PLUGINFINITY_ env key",
			{ x: { command: "sh", extensionToLanguage: { ".md": "markdown" }, env: { PLUGINFINITY_HOST: "x" } } },
		],
		["a negative timeout", { x: { command: "sh", extensionToLanguage: { ".md": "markdown" }, startupTimeout: -1 } }],
		[
			"a fractional maxRestarts",
			{ x: { command: "sh", extensionToLanguage: { ".md": "markdown" }, maxRestarts: 1.5 } },
		],
	];
	for (const [label, input] of rejected) {
		it.effect(`rejects ${label}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decode(input));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}

	it("LSP_FIELDS lists every key of the schema", () => {
		assert.sameMembers(
			[...LSP_FIELDS],
			[
				"command",
				"args",
				"env",
				"extensionToLanguage",
				"initializationOptions",
				"settings",
				"workspaceFolder",
				"startupTimeout",
				"shutdownTimeout",
				"restartOnCrash",
				"maxRestarts",
				"diagnostics",
			],
		);
	});
});
