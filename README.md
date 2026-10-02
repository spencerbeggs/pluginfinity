# pluginfinity

Build one agent-plugin source into every host's plugin format.

> **Under development.** pluginfinity is in early `0.x` development. It installs and runs, but it does not build plugins yet: only `doctor` does its full job today.

pluginfinity reads a host-neutral plugin source (skills, agents, hooks and a `pluginfinity.config.ts`) and writes a complete, self-contained plugin for each target host, starting with Claude Code and GitHub Copilot. It replaces hand-porting a plugin between hosts with a build.

This repository also hosts the pluginfinity companion plugin, which teaches an agent how to author plugins for pluginfinity. It is the successor to [plugin-bot](https://github.com/spencerbeggs/bot), which continues in its own repository.

## Layout

- `packages/pluginfinity/` is the `pluginfinity` package users install: the command and `defineConfig`.
- `packages/core/`, `packages/targets/`, `packages/engine/` and `packages/cli/` are its internal layers, published as `@pluginfinity/*`.
- `plugins/` holds plugins built with pluginfinity: the companion plugin and a dogfood fixture that exercises the CLI end to end.
- `okf/` holds the project's knowledge bundle: purpose, decisions and roadmap.

## License

[MIT](LICENSE)
