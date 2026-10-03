import { cpSync, existsSync } from "node:fs";
import { build } from "@savvy-web/bundler";

await build();

// The bats helper plugin tests load from node_modules/pluginfinity/bats/.
// The bundler copies only what the exports and bin reach, so copy it into
// every package directory this run produced.
for (const pkg of ["dist/dev/pkg", "dist/prod/npm/pkg"]) {
	if (existsSync(pkg)) cpSync("bats", `${pkg}/bats`, { recursive: true });
}
