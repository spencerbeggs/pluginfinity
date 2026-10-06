import { defineConfig } from "pluginfinity";

export default defineConfig({
	name: "pluginfinity-dogfood",
	description: "End-to-end fixture for the pluginfinity CLI",
	hooks: {
		SessionStart: [{ matcher: "startup", script: "hooks/session-start.sh", timeout: 5 }],
		UserPromptSubmit: [{ script: "hooks/user-prompt-submit.sh", timeout: 5 }],
		PreToolUse: [
			{ matcher: "Bash", script: "hooks/pre-tool-use.sh", timeout: 5, failClosed: true },
			{ matcher: "Read", script: "hooks/crash.sh", timeout: 5 },
		],
		PostToolUse: [
			{ matcher: "Bash", script: "hooks/post-tool-use.sh", timeout: 5 },
			{ matcher: "Edit|Write", script: "hooks/post-edit.sh", timeout: 5 },
			{ matcher: "Read", script: "hooks/post-read.sh", timeout: 5 },
		],
		Stop: [{ script: "hooks/stop.sh", timeout: 5 }],
		SubagentStart: [{ script: "hooks/subagent-start.sh", timeout: 5 }],
	},
	mcpServers: { dogfood: { command: "sh", args: ["${PLUGIN_ROOT}/bin/start-mcp.sh"] } },
	lspServers: {
		dogfood: {
			command: "sh",
			args: ["${PLUGIN_ROOT}/bin/start-lsp.sh", "--stdio"],
			extensionToLanguage: { ".dogfood": "plaintext" },
			diagnostics: true,
		},
	},
	monitors: {
		heartbeat: {
			script: "monitors/heartbeat.sh",
			description: "Notifies once per session that the dogfood heartbeat is alive",
		},
		"skill-watch": {
			script: "monitors/skill-watch.sh",
			description: "Notifies once when the hook-eval skill is invoked",
			when: "on-skill-invoke:hook-eval",
		},
	},
	files: ["share/", "bin/dogfood-mcp.sh"],
	claude: true,
	copilot: { files: ["copilot-only/"] },
});
