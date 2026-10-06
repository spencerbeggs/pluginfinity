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

	it("each LSP field Copilot drops is a config note named by server and field; Claude has none", () => {
		const render = renderServers(
			COPILOT,
			"copilot",
			base({
				lspServers: lsp,
				copilot: { lspServers: { own: { command: "sh", extensionToLanguage: { ".a": "a" }, diagnostics: true } } },
			}),
			"demo",
			LIB,
		);
		assert.deepStrictEqual(render.notes, [
			{ target: "copilot", path: "config", kind: "dropped", name: "lspServers.okfit.diagnostics" },
			{ target: "copilot", path: "config", kind: "dropped", name: "lspServers.okfit.restartOnCrash" },
			{ target: "copilot", path: "config", kind: "dropped", name: "copilot.lspServers.own.diagnostics" },
		]);
		assert.deepStrictEqual(renderServers(CLAUDE, "claude", base({ lspServers: lsp }), "demo", LIB).notes, []);
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

describe("renderServers: host root spellings", () => {
	const SPELLINGS = [
		`\${CLAUDE_PLUGIN_ROOT}`,
		`\${COPILOT_PLUGIN_ROOT}`,
		"$CLAUDE_PLUGIN_ROOT",
		"$COPILOT_PLUGIN_ROOT",
		"$PLUGIN_ROOT",
	] as const;

	for (const target of [
		["claude", CLAUDE],
		["copilot", COPILOT],
	] as const) {
		for (const spelling of SPELLINGS) {
			it(`${spelling} in an MCP root field is an issue on ${target[0]} naming the field`, () => {
				const config = base({
					mcpServers: {
						mcp: {
							command: `${spelling}/bin/serve`,
							args: [`${spelling}/bin/start.sh`],
							env: { DATA: `${spelling}/share` },
							...(target[0] === "copilot" ? { cwd: spelling } : {}),
						},
					},
				});
				const render = renderServers(target[1], target[0], config, "demo", LIB);
				const keys = render.issues.map((i) => i.key);
				assert.sameMembers(keys, [
					"mcpServers.mcp.command",
					"mcpServers.mcp.args",
					"mcpServers.mcp.env",
					...(target[0] === "copilot" ? ["mcpServers.mcp.cwd"] : []),
				]);
				for (const issue of render.issues) assert.include(issue.message, R);
			});

			it(`${spelling} in an LSP root field is an issue on ${target[0]} naming the field`, () => {
				const config = base({
					lspServers: {
						md: {
							command: `${spelling}/bin/lsp`,
							args: [`${spelling}/bin/lsp.sh`],
							env: { DATA: `${spelling}/share` },
							extensionToLanguage: { ".md": "markdown" },
							...(target[0] === "claude" ? { workspaceFolder: spelling } : {}),
						},
					},
				});
				const render = renderServers(target[1], target[0], config, "demo", LIB);
				assert.sameMembers(
					render.issues.map((i) => i.key),
					[
						"lspServers.md.command",
						"lspServers.md.args",
						"lspServers.md.env",
						...(target[0] === "claude" ? ["lspServers.md.workspaceFolder"] : []),
					],
				);
			});
		}
	}

	it("the portable spelling, an env key and a longer variable name are not host spellings", () => {
		const config = base({
			mcpServers: {
				mcp: { command: "sh", args: [`${R}/bin/start.sh`, "$PLUGIN_ROOTS"], env: { CLAUDE_PLUGIN_ROOT: "x" } },
			},
			lspServers: { md: { command: "sh", args: [`${R}/bin/lsp.sh`], extensionToLanguage: { ".md": "markdown" } } },
		});
		for (const [id, target] of [
			["claude", CLAUDE],
			["copilot", COPILOT],
		] as const)
			assert.deepStrictEqual(renderServers(target, id, config, "demo", LIB).issues, []);
	});

	it("a host spelling outside the root fields is left alone", () => {
		const config = base({
			mcpServers: { docs: { type: "http", url: "https://e.com", headers: { H: `\${CLAUDE_PLUGIN_ROOT}/h` } } },
			lspServers: {
				md: { command: "sh", extensionToLanguage: { ".md": "markdown" }, initializationOptions: { p: "$PLUGIN_ROOT" } },
			},
		});
		assert.deepStrictEqual(renderServers(CLAUDE, "claude", config, "demo", LIB).issues, []);
	});
});

describe("renderServers: issue keys name an override's origin", () => {
	it("an overridden Copilot LSP server's unresolved field is keyed under copilot.lspServers", () => {
		const render = renderServers(
			COPILOT,
			"copilot",
			base({
				copilot: { lspServers: { x: { command: "s", extensionToLanguage: { ".a": "a" }, settings: {} } } },
			}),
			"demo",
			LIB,
		);
		assert.deepStrictEqual(
			render.issues.map((i) => i.key),
			["copilot.lspServers.x.settings"],
		);
	});

	it("an overridden Claude MCP server's cwd is keyed under claude.mcpServers", () => {
		const render = renderServers(
			CLAUDE,
			"claude",
			base({ claude: { mcpServers: { mcp: { command: "sh", cwd: "bin" } } } }),
			"demo",
			LIB,
		);
		assert.deepStrictEqual(
			render.issues.map((i) => i.key),
			["claude.mcpServers.mcp.cwd"],
		);
	});

	it("an overridden server's host spelling is keyed under its origin", () => {
		const render = renderServers(
			COPILOT,
			"copilot",
			base({ copilot: { mcpServers: { mcp: { command: "sh", args: [`\${CLAUDE_PLUGIN_ROOT}/bin/s.sh`] } } } }),
			"demo",
			LIB,
		);
		assert.deepStrictEqual(
			render.issues.map((i) => i.key),
			["copilot.mcpServers.mcp.args"],
		);
	});
});

describe("serverFiles: reference boundaries and origins", () => {
	it("a : ends a reference, so a PATH-style list names the directory", () => {
		const config = base({ mcpServers: { mcp: { command: "sh", env: { PATH: `${R}/bin:/usr/bin` } } } });
		assert.deepStrictEqual(serverFiles(CLAUDE, "claude", config).others, ["bin"]);
	});

	it("a , ends a reference, so a comma list names each path", () => {
		const config = base({ mcpServers: { mcp: { command: "sh", args: [`${R}/a,${R}/b`] } } });
		assert.deepStrictEqual(serverFiles(CLAUDE, "claude", config).others, ["a", "b"]);
	});

	it("an overridden server owns its paths under its origin", () => {
		const config = base({ copilot: { mcpServers: { only: { command: "sh", args: [`${R}/bin/o.sh`] } } } });
		assert.strictEqual(serverFiles(COPILOT, "copilot", config).owners.get("bin/o.sh"), "copilot.mcpServers.only");
	});
});
