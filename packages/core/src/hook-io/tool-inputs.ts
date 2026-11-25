import { Schema } from "effect";
import { flag, num, oneOf, opt, record, strings, text } from "./build.js";

// The `tool_input` a tool event carries for each built-in tool, as Claude Code
// documents them. Other tools, and every MCP tool, have their own shapes.

const tool = <F extends Schema.Struct.Fields>(name: string, description: string, fields: F) =>
	Schema.Struct(fields).annotate({ title: `${name} tool_input`, description });

const shell = (name: string, example: string) =>
	tool(name, `Arguments of the ${name} tool, which executes ${example}.`, {
		command: text("The command to execute."),
		description: opt(text("What the command does.")),
		timeout: opt(num("Timeout in milliseconds. A value above the maximum is reduced to it.")),
		run_in_background: opt(flag("Whether to run the command in the background.")),
	});

const filePath = (verb: string) =>
	text(
		`Absolute path of the file to ${verb}. Claude Code expands ~ and relative paths before hooks run. On Windows it arrives with backslashes: normalize separators before comparing.`,
	);

/**
 * The documented `tool_input` shape of each built-in tool, by tool name.
 *
 * @public
 */
export const TOOL_INPUTS: Readonly<Record<string, Schema.Codec<unknown, unknown>>> = {
	Bash: shell("Bash", "shell commands"),
	PowerShell: shell("PowerShell", "PowerShell commands; match Bash|PowerShell in a hook that inspects shell commands"),
	Write: tool("Write", "Arguments of the Write tool, which creates or overwrites a file.", {
		file_path: filePath("write"),
		content: text("Content to write to the file."),
	}),
	Edit: tool("Edit", "Arguments of the Edit tool, which replaces a string in an existing file.", {
		file_path: filePath("edit"),
		old_string: text("Text to find and replace."),
		new_string: text("Replacement text."),
		replace_all: opt(flag("Whether to replace every occurrence.")),
	}),
	Read: tool("Read", "Arguments of the Read tool, which reads file contents.", {
		file_path: filePath("read"),
		offset: opt(num("Line number to start reading from.")),
		limit: opt(num("Number of lines to read.")),
	}),
	Glob: tool("Glob", "Arguments of the Glob tool, which finds files matching a glob pattern.", {
		pattern: text("Glob pattern to match files against."),
		path: opt(text("Directory to search in. Defaults to the current working directory.")),
	}),
	Grep: tool("Grep", "Arguments of the Grep tool, which searches file contents with regular expressions.", {
		pattern: text("Regular expression to search for."),
		path: opt(text("File or directory to search in.")),
		glob: opt(text("Glob pattern to filter files.")),
		output_mode: opt(oneOf(["content", "files_with_matches", "count"], "Defaults to files_with_matches.")),
		"-i": opt(flag("Case insensitive search.")),
		multiline: opt(flag("Enable multiline matching.")),
	}),
	WebFetch: tool("WebFetch", "Arguments of the WebFetch tool, which fetches and processes web content.", {
		url: text("URL to fetch content from."),
		prompt: text("Prompt to run on the fetched content."),
		offset: opt(num("Characters to skip from the start of the page. Claude Code 2.1.290 or later.")),
	}),
	WebSearch: tool("WebSearch", "Arguments of the WebSearch tool, which searches the web.", {
		query: text("Search query."),
		allowed_domains: opt(strings("Only include results from these domains.")),
		blocked_domains: opt(strings("Exclude results from these domains.")),
		mode: opt(
			oneOf(
				["standard", "extended"],
				"standard requests a lighter search, extended the full one. Claude Code 2.1.282 or later.",
			),
		),
	}),
	Agent: tool("Agent", "Arguments of the Agent tool, which spawns a subagent.", {
		prompt: text("The task for the agent to perform."),
		description: opt(text("Short description of the task.")),
		subagent_type: opt(text("Type of specialized agent to use, such as Explore.")),
		model: opt(text("Model alias to override the default, such as sonnet.")),
	}),
	AskUserQuestion: tool(
		"AskUserQuestion",
		"Arguments of the AskUserQuestion tool, which asks the user one to four multiple-choice questions. To answer from a PreToolUse hook, return allow with updatedInput holding the original questions plus answers.",
		{
			questions: Schema.Array(
				Schema.Struct({
					question: text("The question text."),
					header: text("A short header."),
					options: Schema.Array(
						Schema.Struct({ label: text("The option's label."), description: opt(text("What the option means.")) }),
					).annotate({ description: "The choices." }),
					multiSelect: opt(flag("Whether several options may be chosen.")),
				}),
			).annotate({ description: "The questions to present." }),
			answers: opt(
				record(
					"Maps question text to the chosen option label; multi-select answers join labels with commas. Claude never sets it: supply it through updatedInput.",
				),
			),
		},
	),
	ExitPlanMode: tool(
		"ExitPlanMode",
		"Arguments of the ExitPlanMode tool, which presents a plan for approval. Claude Code injects the plan content and path before hooks see the input.",
		{
			plan: opt(text("Plan content in Markdown, injected from the plan file.")),
			planFilePath: opt(text("Path to the plan file, injected.")),
			allowedPrompts: opt(Schema.Array(Schema.Unknown).annotate({ description: "Deprecated: accepted and ignored." })),
		},
	),
};
