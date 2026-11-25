// The recipes in the native-hooks skill, as one plugin. A test keeps the skill's
// code blocks identical to these files, and `zig build test` runs every recipe's tests.
// Build the binaries first: `zig build -p hooks`, then `pluginfinity build`.
export default {
	name: "recipes-example",
	description: "The native hook recipes, as a plugin",
	hooks: {
		PreToolUse: [
			{ matcher: "Bash", binary: "hooks/bin/command-guard", timeout: 5, failClosed: true },
			{ matcher: "Bash", binary: "hooks/bin/branch-guard", timeout: 10, if: "Bash(git commit *)" },
		],
		SessionStart: [{ matcher: "startup", binary: "hooks/bin/startup-context", timeout: 5 }],
		PostToolUse: [{ matcher: "Edit|Write", binary: "hooks/bin/post-edit", timeout: 5 }],
		Stop: [{ binary: "hooks/bin/stop-gate", timeout: 5 }],
	},
	claude: true,
	copilot: true,
};
