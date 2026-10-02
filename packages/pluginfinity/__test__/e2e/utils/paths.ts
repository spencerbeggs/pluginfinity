import { resolve } from "node:path";

/** The workspace root: `packages/pluginfinity/__test__/e2e/utils/` is five levels below it. */
const ROOT = resolve(import.meta.dirname, "..", "..", "..", "..", "..");

/** The carrier's built bin: what `pnpm exec pluginfinity` runs in a workspace plugin. */
export const BUILT_BIN = resolve(ROOT, "packages", "pluginfinity", "dist", "dev", "pkg", "bin", "pluginfinity.js");

/** The dogfood fixture plugin. */
export const DOGFOOD = resolve(ROOT, "plugins", "dogfood");
