import { Schema } from "effect";
import { CLAUDE_HOOK_EVENTS } from "../hooks.js";
import { HOOK_IO } from "./events.js";
import { TOOL_INPUTS } from "./tool-inputs.js";

export type { HookIo } from "./events.js";
export { HOOK_IO } from "./events.js";
export { TOOL_INPUTS } from "./tool-inputs.js";
export { hookEventsZig } from "./zig.js";

/**
 * A generated JSON Schema file: its name and its text.
 *
 * @public
 */
export interface HookSchemaFile {
	readonly name: string;
	readonly content: string;
}

const DIALECT = "https://json-schema.org/draft/2020-12/schema";

const render = (schema: Schema.Top): string => {
	const document = Schema.toJsonSchemaDocument(schema);
	const definitions = Object.keys(document.definitions).length === 0 ? {} : { $defs: document.definitions };
	return `${JSON.stringify({ $schema: DIALECT, ...document.schema, ...definitions }, null, "\t")}\n`;
};

/**
 * The JSON Schema documents for every Claude Code hook event, one for its
 * input and one for its output, and one for each built-in tool's
 * `tool_input`. The text is deterministic, so a regeneration that changes
 * nothing writes the same bytes.
 *
 * @public
 */
export const hookSchemaFiles = (): ReadonlyArray<HookSchemaFile> => [
	...CLAUDE_HOOK_EVENTS.flatMap((event) => [
		{ name: `${event}.input.schema.json`, content: render(HOOK_IO[event].input) },
		{ name: `${event}.output.schema.json`, content: render(HOOK_IO[event].output) },
	]),
	...Object.entries(TOOL_INPUTS).map(([tool, schema]) => ({
		name: `tool-input.${tool}.schema.json`,
		content: render(schema),
	})),
];
