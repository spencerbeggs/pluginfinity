import { assert, describe, it } from "@effect/vitest";
import type { PluginfinityConfig } from "@pluginfinity/targets";
import { TARGETS } from "@pluginfinity/targets";
import { renderServers, serverFiles } from "../src/servers.js";

const CLAUDE = TARGETS.find((t) => t.id === "claude")!.target;
const COPILOT = TARGETS.find((t) => t.id === "copilot")!.target;
const LIB = "lib/pluginfinity";
const R = `\${PLUGIN_ROOT}`;

const base = (extra: Partial<PluginfinityConfig>): PluginfinityConfig =>
	({ name: "demo", description: "d", claude: true, copilot: true, ...extra }) as PluginfinityConfig;

const json = (render: ReturnType<typeof renderServers>, path: string) => {
	const file = render.files.find((f) => f.path === path);
	return file === undefined ? undefined : JSON.parse(String(file.content));
};

describe("renderServers: MCP", () => {
	const config = base({
		mcpServers: {
			mcp: { command: "sh", args: [`${R}/bin/start-mcp.sh`, `--config=${R}/etc/c.json`], env: { A: `${R}/x` } },
			docs: { type: "http", url: "https://example.com/mcp" },
			events: { type: "sse", url: "https://example.com/sse" },
		},
	});

	it("writes .mcp.json for Claude with the root rewritten everywhere and the env injected", () => {
		const render = renderServers(CLAUDE, "claude", config, "demo", LIB);
		assert.deepStrictEqual(json(render, ".mcp.json"), {
			mcpServers: {
				mcp: {
					command: "sh",
					args: ["${CLAUDE_PLUGIN_ROOT}/bin/start-mcp.sh", "--config=${CLAUDE_PLUGIN_ROOT}/etc/c.json"],
					env: {
						A: "${CLAUDE_PLUGIN_ROOT}/x",
						PLUGINFINITY_HOST: "claude",
						PLUGINFINITY_PLUGIN: "demo",
						PLUGINFINITY_LIB: "${CLAUDE_PLUGIN_ROOT}/lib/pluginfinity",
					},
				},
				docs: { type: "http", url: "https://example.com/mcp" },
				events: { type: "sse", url: "https://example.com/sse" },
			},
		});
		assert.isTrue(render.stdio);
		assert.deepStrictEqual(render.issues, []);
	});

	it("writes mcp.json for Copilot with $schema, explicit stdio and streamable-http", () => {
		const out = json(renderServers(COPILOT, "copilot", config, "demo", LIB), "mcp.json");
		assert.strictEqual(out.$schema, "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
		assert.strictEqual(out.mcpServers.mcp.type, "stdio");
		assert.strictEqual(out.mcpServers.mcp.args[0], "${PLUGIN_ROOT}/bin/start-mcp.sh");
		assert.strictEqual(out.mcpServers.mcp.env.PLUGINFINITY_HOST, "copilot");
		assert.strictEqual(out.mcpServers.docs.type, "streamable-http");
		assert.strictEqual(out.mcpServers.events.type, "sse");
	});

	it("a remote-only plugin is not stdio and gets no injected env", () => {
		const render = renderServers(
			CLAUDE,
			"claude",
			base({ mcpServers: { docs: { type: "http", url: "https://e.com/mcp" } } }),
			"demo",
			LIB,
		);
		assert.isFalse(render.stdio);
		assert.deepStrictEqual(json(render, ".mcp.json").mcpServers.docs, { type: "http", url: "https://e.com/mcp" });
	});

	it("a target override replaces the base server of the same name", () => {
		const render = renderServers(
			COPILOT,
			"copilot",
			base({ mcpServers: { mcp: { command: "a" } }, copilot: { mcpServers: { mcp: { command: "b" } } } }),
			"demo",
			LIB,
		);
		assert.strictEqual(json(render, "mcp.json").mcpServers.mcp.command, "b");
	});

	it("a Claude MCP cwd naming the root is an issue, since Claude ignores an MCP cwd", () => {
		const render = renderServers(
			CLAUDE,
			"claude",
			base({ mcpServers: { mcp: { command: "sh", cwd: R } } }),
			"demo",
			LIB,
		);
		assert.deepStrictEqual(
			render.issues.map((i) => i.key),
			["mcpServers.mcp.cwd"],
		);
	});

	it("no servers means no file and not stdio", () => {
		const render = renderServers(CLAUDE, "claude", base({}), "demo", LIB);
		assert.deepStrictEqual(render.files, []);
		assert.isFalse(render.stdio);
	});
});

describe("renderServers: LSP", () => {
	const lsp = {
		okfit: {
			command: "sh",
			args: [`${R}/bin/start-lsp.sh`, "--stdio"],
			extensionToLanguage: { ".md": "markdown" },
			diagnostics: true,
			restartOnCrash: false,
		},
	};

	it("writes .lsp.json for Claude as a bare map with every field kept", () => {
		const out = json(renderServers(CLAUDE, "claude", base({ lspServers: lsp }), "demo", LIB), ".lsp.json");
		assert.deepStrictEqual(out.okfit.extensionToLanguage, { ".md": "markdown" });
		assert.strictEqual(out.okfit.diagnostics, true);
		assert.strictEqual(out.okfit.args[0], "${CLAUDE_PLUGIN_ROOT}/bin/start-lsp.sh");
		assert.strictEqual(out.okfit.env.PLUGINFINITY_HOST, "claude");
	});

	it("writes com.github.copilot/lsp.json with fileExtensions and the lifecycle fields dropped", () => {
		const out = json(
			renderServers(COPILOT, "copilot", base({ lspServers: lsp }), "demo", LIB),
			"com.github.copilot/lsp.json",
		);
		assert.deepStrictEqual(Object.keys(out), ["lspServers"]);
		assert.deepStrictEqual(out.lspServers.okfit.fileExtensions, { ".md": "markdown" });
		assert.notProperty(out.lspServers.okfit, "extensionToLanguage");
		assert.notProperty(out.lspServers.okfit, "diagnostics");
		assert.notProperty(out.lspServers.okfit, "restartOnCrash");
	});

	it("an unresolved field on Copilot is an issue naming the server and field", () => {
		const render = renderServers(
			COPILOT,
			"copilot",
			base({
				lspServers: { x: { command: "s", extensionToLanguage: { ".a": "a" }, settings: {}, workspaceFolder: R } },
			}),
			"demo",
			LIB,
		);
		assert.sameMembers(
			render.issues.map((i) => i.key),
			["lspServers.x.settings", "lspServers.x.workspaceFolder"],
		);
	});
});

describe("serverFiles", () => {
	it("splits whole-command paths from every other reference, per target", () => {
		const config = base({
			mcpServers: { a: { command: `${R}/bin/a.sh`, args: [`--c=${R}/etc/c.json`] } },
			lspServers: {
				b: { command: "sh", args: [`${R}/bin/b.sh`], extensionToLanguage: { ".b": "b" }, env: { D: `${R}/share/d` } },
			},
			copilot: { mcpServers: { only: { command: "sh", args: [`${R}/bin/copilot-only.sh`] } } },
		});
		const claude = serverFiles(CLAUDE, "claude", config);
		assert.deepStrictEqual(claude.commands, ["bin/a.sh"]);
		assert.deepStrictEqual(claude.others, ["etc/c.json", "bin/b.sh", "share/d"]);
		assert.strictEqual(claude.owners.get("bin/a.sh"), "mcpServers.a");
		assert.strictEqual(claude.owners.get("bin/b.sh"), "lspServers.b");
		assert.include(serverFiles(COPILOT, "copilot", config).others, "bin/copilot-only.sh");
		assert.notInclude(serverFiles(CLAUDE, "claude", config).others, "bin/copilot-only.sh");
	});

	it("scans only the documented fields and not the ones a target leaves unresolved", () => {
		const config = base({
			mcpServers: {
				docs: { type: "http", url: "https://e.com", headers: { H: `${R}/remote/h` } },
				local: { command: "sh", args: [`${R}/bin/l.sh`] },
			},
			lspServers: {
				x: {
					command: "sh",
					extensionToLanguage: { ".a": "a" },
					initializationOptions: { path: `${R}/init/x` },
					settings: { path: `${R}/settings/x` },
					workspaceFolder: `${R}/ws`,
				},
			},
		});
		const claude = serverFiles(CLAUDE, "claude", config);
		assert.deepStrictEqual(claude.others, ["bin/l.sh", "ws"]);
		assert.deepStrictEqual(serverFiles(COPILOT, "copilot", config).others, ["bin/l.sh"]);
	});
});

describe("renderServers: scoped rewriting", () => {
	it("leaves initializationOptions, settings and remote servers untouched", () => {
		const config = base({
			mcpServers: { docs: { type: "http", url: "https://e.com", headers: { H: `${R}/h` } } },
			lspServers: {
				x: {
					command: "sh",
					extensionToLanguage: { ".a": "a" },
					initializationOptions: { path: `${R}/init` },
					settings: { path: `${R}/s` },
				},
			},
		});
		const render = renderServers(CLAUDE, "claude", config, "demo", LIB);
		assert.strictEqual(json(render, ".mcp.json").mcpServers.docs.headers.H, `${R}/h`);
		assert.strictEqual(json(render, ".lsp.json").x.initializationOptions.path, `${R}/init`);
		assert.strictEqual(json(render, ".lsp.json").x.settings.path, `${R}/s`);
	});

	it("a literal Claude MCP cwd is an issue and is left out; Copilot keeps it", () => {
		const config = base({ mcpServers: { mcp: { command: "sh", cwd: "bin" } } });
		const claude = renderServers(CLAUDE, "claude", config, "demo", LIB);
		assert.deepStrictEqual(
			claude.issues.map((i) => i.key),
			["mcpServers.mcp.cwd"],
		);
		assert.notProperty(json(claude, ".mcp.json").mcpServers.mcp, "cwd");
		const copilot = renderServers(COPILOT, "copilot", config, "demo", LIB);
		assert.deepStrictEqual(copilot.issues, []);
		assert.strictEqual(json(copilot, "mcp.json").mcpServers.mcp.cwd, "bin");
	});
});
