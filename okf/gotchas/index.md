# Gotcha

* [A workspace plugin gets no pluginfinity bin unless the carrier is relinked after its build](workspace-bin-needs-built-cli.md) - pnpm links the plugin workspaces before any prepare build runs, so no pluginfinity shim is created and a repeat install or a later build does not repair it; the carrier's postprepare relinks.
* [Under Claude Code a plain pluginfinity doctor prints JSON, not the checklist](agent-environment-selects-json-output.md) - CLAUDECODE and AI\_AGENT in the environment select the agent audience, so doctor and config errors come out as one JSON object even with no --agent flag; --human forces the checklist.
* [build --check reports BuildStale on .sh files right after a commit, with no diff](build-check-stale-on-sh-after-commit.md) - lint-staged strips the executable bit from staged \*.sh files while the build copies hook scripts with their source mode and compares modes, so the build looks stale until the next pluginfinity build.
