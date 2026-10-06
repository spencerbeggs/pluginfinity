#!/usr/bin/env bats
bats_require_minimum_version 1.5.0

setup() {
	BUILDS="$BATS_TEST_DIRNAME/../builds"
	SKILL="skills/hook-eval/SKILL.md"
	REF="skills/hook-eval/references/report-template.md"
}

@test "claude renders tokens and links in the skill" {
	f="$BUILDS/claude/$SKILL"
	grep -qF 'Read files with Read and' "$f"
	grep -qF 'echo tool, mcp__plugin_pluginfinity-dogfood_dogfood__echo.' "$f"
	grep -qF 'Delegate to pluginfinity-dogfood:eval-subagent,' "$f"
	grep -qF '(`pluginfinity-dogfood:eval-subagent`)' "$f"
	grep -qF 'This skill is /pluginfinity-dogfood:hook-eval;' "$f"
	grep -qF '[the report template](${CLAUDE_PLUGIN_ROOT}/skills/hook-eval/references/report-template.md)' "$f"
	grep -qF 'The plugin root is ${CLAUDE_PLUGIN_ROOT}.' "$f"
}

@test "copilot renders tokens and links in the skill" {
	f="$BUILDS/copilot/$SKILL"
	grep -qF 'Read files with view and' "$f"
	grep -qF 'echo tool, dogfood-echo.' "$f"
	grep -qF 'Delegate to pluginfinity-dogfood:eval-subagent,' "$f"
	grep -qF '(`pluginfinity-dogfood:eval-subagent`)' "$f"
	grep -qF 'This skill is /pluginfinity-dogfood:hook-eval;' "$f"
	grep -qF 'the report template (the `hook-eval` skill'"'"'s `references/report-template.md`)' "$f"
	run ! grep -qF 'plugin root is' "$f"
}

@test "no pluginfinity:// link or token survives in either build" {
	for host in claude copilot; do
		run ! grep -rqE 'pluginfinity://|\{\{(tool|agent|skill|plugin_root)' "$BUILDS/$host/skills"
	done
}

@test "tokens render in a skill reference file on both hosts" {
	grep -qF 'with Write under' "$BUILDS/claude/$REF"
	grep -qF 'with Read so' "$BUILDS/claude/$REF"
	grep -qF 'skill is /pluginfinity-dogfood:hook-eval.' "$BUILDS/claude/$REF"
	grep -qF 'with create under' "$BUILDS/copilot/$REF"
	grep -qF 'with view so' "$BUILDS/copilot/$REF"
	grep -qF 'skill is /pluginfinity-dogfood:hook-eval.' "$BUILDS/copilot/$REF"
}
