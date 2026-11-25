// An example plugin whose one hook is a native binary built with pluginfinity-hooks.
// Build the binaries first: `zig build -p hooks`, then `pluginfinity build`.
export default {
	name: "guard-example",
	description: "Refuses a force push, from a prebuilt native hook",
	hooks: {
		PreToolUse: [{ matcher: "Bash", binary: "hooks/bin/guard", timeout: 5, failClosed: true }],
	},
	claude: true,
	copilot: true,
};
