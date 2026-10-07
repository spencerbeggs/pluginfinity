---
"@pluginfinity/ai-plugins": patch
---

## Documentation

* Hook, plugin-scripts and migration skills and the plugin-engineer agent cover the new logging standard, `PLUGINFINITY_DEBUG`, the `hook_allow` reason argument and `hook_project_dir` semantics.
* New `session-env` reference and updated skills teach the `env` block, the precedence chain, `hook_env_set`, `hook_supports env-shell`, the setup script contract, the SessionStart wait and `env-wait-timeout`, sourcing `env.sh` from skill scripts and monitors, and a migration recipe from a hand-rolled per-session env.
* The skills teach `{{skill_dir}}`, the SessionStart `startup` to `startup|new` widening and its notes, `pluginfinity logs`, the four new build notes, `--session-env`, `--env-file`, `run_script` interpreters and the Claude skill-script environment (Copilot's is not measured and assumed minimal), `run_monitor --timeout`, the tick contract for event-driven monitors, and indented host-block markers inside list items.
* The plugin-engineer agent applies session env, `{{skill_dir}}` and the new helpers.
* The session-env migration recipe gives a name its readers detect when empty `default: ""` and leaves per-command overrides undeclared.
* New monitors reference, plus updated config, targets and findings references.
* The skills document `hook_has`, `hook_tool_prefix`, the code-span tool token, `run_hook`, `run_script` and `run_monitor`, the `PLUGINFINITY_MONITOR_MAX_TICKS` contract, both monitor command shapes, and the unknown-manager fall-through.
* The skills build the `env.sh` path from an absolute directory before any `cd` (the one-line form broke after a `cd` from a relative `$0`), show the shellcheck `source` directive and the manual `_pf_env_manual=1` form, and document `hook_supports server-project` beside `server_project_dir`.
