import { Schema } from "effect";
import { CLAUDE_HOOK_EVENTS } from "../hooks.js";
import { HOOK_IO } from "./events.js";
import { TOOL_INPUTS } from "./tool-inputs.js";

// The hook event inputs as Zig types, for the native hook library: one struct
// per event, read from the same schemas the JSON Schema files come from.

interface Json {
	readonly [key: string]: unknown;
}

const KEYWORDS = new Set(
	"addrspace align allowzero and anyframe anytype asm async await break callconv catch comptime const continue defer else enum errdefer error export extern fn for if inline linksection noalias noinline nosuspend opaque or orelse packed pub resume return struct suspend switch test threadlocal try union unreachable usingnamespace var volatile while".split(
		" ",
	),
);

const identifier = (name: string): string =>
	/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !KEYWORDS.has(name) ? name : `@"${name}"`;

// The fields every event may carry. A host other than Claude Code sends fewer
// of them, so they are optional in the Zig types whatever the schema says.
const COMMON = new Set([
	"session_id",
	"transcript_path",
	"cwd",
	"prompt_id",
	"scratchpad_dir",
	"permission_mode",
	"effort",
	"agent_id",
	"agent_type",
]);

const zigType = (schema: Json, indent: string): string => {
	if (Array.isArray(schema.anyOf)) {
		const variants = schema.anyOf as ReadonlyArray<Json>;
		const present = variants.filter((variant) => variant.type !== "null");
		const [only] = present;
		return present.length === 1 && variants.length === 2 && only !== undefined
			? `?${zigType(only, indent)}`
			: "std.json.Value";
	}
	// A value outside the documented set must still parse, so an enum is text.
	if (Array.isArray(schema.enum)) return "[]const u8";
	if (schema.type === "string") return "[]const u8";
	if (schema.type === "number") return "f64";
	if (schema.type === "boolean") return "bool";
	if (schema.type === "array") return `[]const ${zigType((schema.items ?? {}) as Json, indent)}`;
	if (schema.type === "object" && schema.properties !== undefined) return zigStruct(schema, indent, false);
	return "std.json.Value";
};

const zigStruct = (schema: Json, indent: string, event: boolean): string => {
	const inner = `${indent}    `;
	const required = new Set((schema.required ?? []) as ReadonlyArray<string>);
	const fields = Object.entries(schema.properties as Readonly<Record<string, Json>>).map(([name, field]) => {
		const type = zigType(field, inner);
		const optional = !required.has(name) || (event && COMMON.has(name));
		const doc = typeof field.description === "string" ? `${inner}/// ${field.description}\n` : "";
		const spelled = optional ? `${type.startsWith("?") ? type : `?${type}`} = null` : type;
		return `${doc}${inner}${identifier(name)}: ${spelled},\n`;
	});
	return `struct {\n${fields.join("")}${indent}}`;
};

const declaration = (name: string, schema: Schema.Top, indent: string, event: boolean): string => {
	const json = Schema.toJsonSchemaDocument(schema).schema as Json;
	const doc = typeof json.description === "string" ? `${indent}/// ${json.description}\n` : "";
	return `${doc}${indent}pub const ${identifier(name)} = ${zigStruct(json, indent, event)};\n`;
};

/**
 * The Zig source of `zig/src/events.zig`: a struct for each Claude Code hook
 * event's input and, under `tools`, for each built-in tool's `tool_input`. The
 * text is what `zig fmt` would write, so a regeneration that changes nothing
 * writes the same bytes.
 *
 * @public
 */
export const hookEventsZig = (): string =>
	[
		"//! Generated from the hook event schemas in @pluginfinity/core. Do not edit:",
		"//! run `pnpm --filter @pluginfinity/core run hook-io:zig`.",
		"//!",
		"//! One struct per Claude Code hook event, as `Hook.as` reads it. The fields every",
		"//! event may carry are optional, since a host other than Claude Code sends fewer;",
		"//! an event's own fields are required where Claude Code always sends them. A",
		"//! field whose values are a documented set is text, so a value added later still",
		"//! parses, and a free-form field is a `std.json.Value`.",
		"",
		'const std = @import("std");',
		"",
		...CLAUDE_HOOK_EVENTS.map((event) => declaration(event, HOOK_IO[event].input, "", true)),
		"/// The `tool_input` of each built-in tool, as `Hook.toolInput` reads it.",
		"pub const tools = struct {",
		Object.entries(TOOL_INPUTS)
			.map(([tool, schema]) => declaration(tool, schema, "    ", false))
			.join("\n")
			.trimEnd(),
		"};",
		"",
	].join("\n");
