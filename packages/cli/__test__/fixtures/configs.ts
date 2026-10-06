// Config file bodies the CLI tests write to disk.

export const BOTH_TARGETS = `export default { name: "both-targets", description: "Fixture plugin.", claude: true, copilot: true };\n`;

export const ONLY_COPILOT = `export default { name: "only-copilot", description: "Fixture plugin.", copilot: true };\n`;

export const PACKAGE_JSON = `{ "name": "fixture-package", "version": "1.2.3" }\n`;

/** A plugin whose agent, skill, hooks and LSP server each lose something on Copilot, with every component file. */
export const NOTED_TREE: Readonly<Record<string, string>> = {
	"pluginfinity.config.ts": `export default {
	name: "noted",
	description: "Fixture plugin.",
	hooks: { Setup: [{ script: "hooks/setup.sh", fallback: "omit" }] },
	lspServers: { md: { command: "sh", extensionToLanguage: { ".md": "markdown" }, diagnostics: true } },
	claude: true,
	copilot: true,
};\n`,
	"package.json": PACKAGE_JSON,
	"hooks/setup.sh": "#!/bin/bash\n",
	"agents/x.md": "---\nname: x\ndescription: Does x.\ncolor: red\nmaxTurns: 3\n---\n\nBody.\n",
	"skills/s/SKILL.md": "---\nname: s\ndescription: Does s.\npaths: src/**\nallowed-tools: Read ToolSearch\n---\n\nBody.\n",
};
