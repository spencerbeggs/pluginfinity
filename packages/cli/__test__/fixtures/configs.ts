// Config file bodies the CLI tests write to disk.

export const BOTH_TARGETS = `export default { name: "both-targets", description: "Fixture plugin.", claude: true, copilot: true };\n`;

export const ONLY_COPILOT = `export default { name: "only-copilot", description: "Fixture plugin.", copilot: true };\n`;

export const PACKAGE_JSON = `{ "name": "fixture-package", "version": "1.2.3" }\n`;
