# Module

* [@pluginfinity/cli](cli.md) - The pluginfinity command-line front end on @effected/cli; it holds the command tree, renders what the engine computes for people or agents, declares no bin, and runs through the carrier's shim.
* [@pluginfinity/core](core.md) - The platform-free pluginfinity domain model; today the plugin-wide config fields and the per-target override shape, later the plugin source model and the Target capability schema.
* [@pluginfinity/engine](engine.md) - The pluginfinity logic shared by every front end; today config discovery, loading and strict decoding, the typed config errors, the doctor program and the front half of build and validate, and ENGINE\_VERSION.
* [@pluginfinity/targets](targets.md) - The hosts pluginfinity builds for (Claude Code as claude, GitHub Copilot as copilot) as a registry, plus the assembled PluginfinityConfig schema; versioned apart from core.
* [dogfood plugin fixture](dogfood.md) - plugins/dogfood, an end-to-end fixture that builds a plugin with the real CLI to exercise features the companion plugin does not use; never released.
* [pluginfinity carrier package](pluginfinity.md) - The unscoped pluginfinity package users install; it owns the pluginfinity bin as a thin shim over @pluginfinity/cli and exports defineConfig, typed against the targets registry, for pluginfinity.config.ts.
* [pluginfinity companion plugin](pluginfinity-plugin.md) - plugins/pluginfinity, the agent plugin that teaches how to author plugins for pluginfinity; built by pluginfinity and the successor to plugin-bot.
