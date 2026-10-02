// Config file bodies the loader tests write to disk. Kept as strings because
// two of them are deliberately broken TypeScript.

export const VALID = `export default { name: "valid-plugin", claude: { name: "valid-claude" }, copilot: true };\n`;

export const VALID_WITH_IMPORT = `import { shared } from "./shared.js";\nexport default { name: shared, claude: true };\n`;

export const SHARED_MODULE = `export const shared = "shared-name";\n`;

export const SYNTAX_ERROR = `export default { name: "broken", claude: true \n`;

export const UNRESOLVED_IMPORT = `import { missing } from "./does-not-exist.js";\nexport default { name: missing, claude: true };\n`;

export const INVALID_SHAPE = `export default { name: "Not Kebab", claude: false };\n`;

export const UNKNOWN_KEY = `export default { name: "typo", claud: true };\n`;

export const NESTED_UNKNOWN_KEY = `export default { name: "x", claude: { nam: "y" } };\n`;

export const NO_TARGET = `export default { name: "lonely" };\n`;

export const NO_DEFAULT = `export const name = "no-default";\n`;

export const ONLY_COPILOT = `export default { name: "only-copilot", copilot: true };\n`;

export const THROWS_ON_LOAD = `throw new Error("config exploded");\nexport default { name: "never", claude: true };\n`;

export const NULL_DEFAULT = `export default null;\n`;

export const FUNCTION_DEFAULT = `export default () => ({ name: "lazy", claude: true });\n`;

export const HANGS_ON_LOAD = `await new Promise(() => {});\nexport default { name: "hangs", claude: true };\n`;
