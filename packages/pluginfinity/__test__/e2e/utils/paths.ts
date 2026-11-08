import { resolve } from "node:path";

/** The workspace root: `packages/pluginfinity/__test__/e2e/utils/` is five levels below it. */
const ROOT = resolve(import.meta.dirname, "..", "..", "..", "..", "..");

/** The carrier's source bin: what `pnpm exec pluginfinity` runs in a workspace plugin. It registers tsx itself. */
export const SOURCE_BIN = resolve(ROOT, "packages", "pluginfinity", "src", "bin", "pluginfinity.ts");

/** The dogfood fixture plugin. */
export const DOGFOOD = resolve(ROOT, "plugins", "dogfood");
