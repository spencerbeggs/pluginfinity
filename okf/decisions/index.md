# Decision

* [The tool is named pluginfinity](pluginfinity-name.md) - pluginfinity names the CLI, its carrier package, its bin and its config file, with the layer packages under the @pluginfinity npm scope.
* [pluginfinity is a CLI application in its own repository](pluginfinity-is-a-cli-application.md) - The single-source plugin builder ships as a standalone @effected/cli application with a companion plugin that succeeds plugin-bot, not as an @effected kit package developed inside the bot marketplace repository.
* [pluginfinity ships as a carrier package over scoped layer packages](pluginfinity-ships-as-a-carrier-package.md) - The CLI is split into @pluginfinity/core, @pluginfinity/targets, @pluginfinity/engine and @pluginfinity/cli, with the unscoped pluginfinity package as the carrier that owns the bin; only what the carrier exports is supported surface.
