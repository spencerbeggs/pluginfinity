import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { McpServers } from "../src/index.js";
import { decodeStrict } from "./utils/decode.js";

const decode = decodeStrict(McpServers);

describe("McpServers", () => {
	it.effect("accepts stdio and remote servers in Claude Code's .mcp.json shape", () =>
		Effect.gen(function* () {
			const servers = {
				local: { command: "bash", args: [`\${PLUGIN_ROOT}/mcp/serve.sh`], env: { MODE: "x" }, cwd: `\${PLUGIN_ROOT}` },
				typed: { type: "stdio" as const, command: "bash" },
				docs: { type: "http" as const, url: "https://example.com/mcp", headers: { Authorization: "Bearer x" } },
				events: { type: "sse" as const, url: "http://localhost:3000/sse" },
			};
			assert.deepStrictEqual(yield* decode(servers), servers);
		}),
	);

	const rejected: ReadonlyArray<readonly [string, unknown]> = [
		["a remote server without a url", { a: { type: "http" } }],
		["a non-http url", { a: { type: "http", url: "ftp://example.com" } }],
		["an unknown transport", { a: { type: "websocket", url: "https://example.com" } }],
		["a stdio server without a command", { a: { args: ["x"] } }],
		["a url on a stdio server", { a: { command: "bash", url: "https://example.com" } }],
	];
	for (const [label, input] of rejected) {
		it.effect(`rejects ${label}`, () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(decode(input));
				assert.strictEqual(error._tag, "SchemaError");
			}),
		);
	}
});
