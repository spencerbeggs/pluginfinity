import { LocalExec, ToolDiscovery } from "@effected/commands";
import { Layer } from "effect";
import type { ChildProcessSpawner } from "effect/process";

/**
 * The `ToolDiscovery` doctor uses in production: global lookups only, over the
 * platform's `ChildProcessSpawner`. Bound once so every provide shares it.
 *
 * @public
 */
export const ToolDiscoveryLive: Layer.Layer<ToolDiscovery, never, ChildProcessSpawner.ChildProcessSpawner> =
	ToolDiscovery.layer.pipe(Layer.provide(LocalExec.layerNone));
