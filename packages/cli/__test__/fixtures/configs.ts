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

/** A plugin whose Claude target publishes under its own name. */
export const RENAMED_TARGET = `export default { name: "shared-name", description: "Fixture plugin.", claude: { name: "claude-name" }, copilot: true };\n`;

/** A state directory with two plugins' logs, one line of each kind, and one line that is not a log line. */
export const STATE_TREE: Readonly<Record<string, string>> = {
	"state/pluginfinity/both-targets/error.log":
		"2026-10-06T10:00:00Z [claude] hook/guard.sh: first\nnot a log line\n2026-10-06T10:00:02Z [copilot] server/start.sh: third\n",
	"state/pluginfinity/both-targets/debug.log": "2026-10-06T10:00:01Z [claude] hook/guard.sh: debug detail\n",
	"state/pluginfinity/other/error.log": "2026-10-06T10:00:03Z [claude] monitor/watch.sh: from other\n",
	"state/pluginfinity/claude-name/error.log": "2026-10-06T10:00:04Z [claude] script/x.sh: renamed\n",
	"state/pluginfinity/shared-name/error.log": "2026-10-06T10:00:05Z [copilot] script/y.sh: shared\n",
};
