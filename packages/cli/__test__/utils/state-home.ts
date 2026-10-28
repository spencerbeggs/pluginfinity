import { ConfigProvider, Effect, Layer } from "effect";
import { ShellStateXdg, stateHome } from "../../src/state-home.js";

/**
 * The state directory `main` resolves for `env`: the shipped layer, reading
 * `env` instead of `process.env` the way the ambient provider reads it.
 */
export const stateHomeFor = (env: Readonly<Record<string, string>>): Effect.Effect<string> =>
	stateHome.pipe(
		Effect.provide(Layer.provide(ShellStateXdg, ConfigProvider.layer(ConfigProvider.fromEnv({ env: { ...env } })))),
	);
