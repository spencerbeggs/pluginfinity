# Decision

* [Built plugins carry no Node dependencies](plugins-carry-no-node-dependencies.md) - For the first release, a plugin pluginfinity builds is markdown, JSON and bash scripts only, with no Node runtime dependencies to install.
* [The copilot target emits Agent Plugins 1.0](copilot-target-emits-agent-plugins.md) - pluginfinity's copilot target writes plugins in the Agent Plugins 1.0 (Open Plugin Spec) format, not Copilot CLI's legacy plugin format.
* [The tool is named pluginfinity](pluginfinity-name.md) - pluginfinity names the CLI, its carrier package, its bin and its config file, with the layer packages under the @pluginfinity npm scope.
* [pluginfinity is a CLI application in its own repository](pluginfinity-is-a-cli-application.md) - The single-source plugin builder ships as a standalone @effected/cli application with a companion plugin that succeeds plugin-bot, not as an @effected kit package developed inside the bot marketplace repository.
* [pluginfinity ships as a carrier package over scoped layer packages](pluginfinity-ships-as-a-carrier-package.md) - The CLI is split into @pluginfinity/core, @pluginfinity/targets, @pluginfinity/engine and @pluginfinity/cli, with the unscoped pluginfinity package as the carrier that owns the bin; only what the carrier exports is supported surface.
