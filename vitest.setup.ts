import { AgentPlugin } from "@vitest-agent/plugin";

export function setup() {
	// Workspace links resolve to source, so no package needs building first. The plugin builds run so the
	// tests that read plugins/*/builds/ see what the current source produces.
	AgentPlugin.runScript("pnpm exec turbo run build --filter=./plugins/* --output-logs=errors-only");
}
