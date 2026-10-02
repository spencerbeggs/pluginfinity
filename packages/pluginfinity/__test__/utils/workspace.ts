import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Workspaces } from "@effected/workspaces";
import type { BoundaryRule } from "@effected/workspaces/testing";
import { Layer } from "effect";

/** The workspace root: `packages/pluginfinity/__test__/utils/` is four levels below it. */
export const ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");

/** The committed layering policy. */
export const POLICY_PATH = resolve(import.meta.dirname, "..", "fixtures", "layers.json");

/** The `src/` directory of the workspace package in `packages/<dir>`. */
export const packageSrc = (dir: string): string => resolve(ROOT, "packages", dir, "src");

/**
 * Forbids the bundler's version define everywhere; each scan waives it for
 * `version.ts` alone, so the define stays confined to that one file.
 */
export const VERSION_DEFINE: BoundaryRule = { forbidTokens: ["process.env.__PACKAGE_VERSION__"] };

/** Workspace discovery over the real filesystem, rooted at {@link ROOT}. */
export const WorkspaceLive = Workspaces.layer({ cwd: ROOT }).pipe(Layer.provideMerge(NodeServices.layer));
