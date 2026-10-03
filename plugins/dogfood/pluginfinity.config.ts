import { defineConfig } from "pluginfinity";

export default defineConfig({
	name: "pluginfinity-dogfood",
	description: "End-to-end fixture for the pluginfinity CLI",
	hooks: {
		SessionStart: [{ script: "hooks/session-start.sh", timeout: 5 }],
		UserPromptSubmit: [{ script: "hooks/user-prompt-submit.sh", timeout: 5 }],
		PreToolUse: [
			{ matcher: "Bash", script: "hooks/pre-tool-use.sh", timeout: 5 },
			{ matcher: "Read", script: "hooks/crash.sh", timeout: 5 },
		],
		PostToolUse: [{ matcher: "Bash", script: "hooks/post-tool-use.sh", timeout: 5 }],
		Stop: [{ script: "hooks/stop.sh", timeout: 5 }],
		SubagentStart: [{ script: "hooks/subagent-start.sh", timeout: 5 }],
	},
	claude: true,
	copilot: true,
});
