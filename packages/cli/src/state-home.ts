// The state directory the CLI reads logs from, by the rule the shell log
// library writes them by: `${XDG_STATE_HOME:-${HOME:-/nonexistent}/.local/state}`.

import type { XdgEnvOptions } from "@effected/xdg";
import { Xdg } from "@effected/xdg";
import { Effect, Layer } from "effect";

/**
 * The XDG departures that make the kit read `XDG_STATE_HOME` as `log.sh`'s
 * `:-` does: an empty variable is unset, a relative `XDG_STATE_HOME` is kept as
 * given, and a missing `HOME` is `/nonexistent`, never the OS home directory.
 */
export const SHELL_STATE_RULE: XdgEnvOptions = { homeFallback: () => "/nonexistent", relativeHomes: "keep" };

/**
 * The XDG environment read from the ambient `ConfigProvider` by
 * {@link SHELL_STATE_RULE}. The fallback home is never empty, so the layer's
 * one failure, a missing home, cannot happen.
 */
export const ShellStateXdg: Layer.Layer<Xdg> = Xdg.layerWith(SHELL_STATE_RULE).pipe(Layer.orDie);

/**
 * `XDG_STATE_HOME`, else `<home>/.local/state`, joined as the shell joins it
 * (a trailing `/` on `HOME` is kept, as `log.sh` keeps it).
 */
export const stateHome: Effect.Effect<string, never, Xdg> = Effect.gen(function* () {
	const xdg = yield* Xdg;
	return xdg.stateHome ?? `${xdg.home}/.local/state`;
});
