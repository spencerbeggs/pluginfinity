// Write the hook event JSON Schemas (src/hook-io) into a directory, replacing
// what is there: `tsx scripts/write-hook-schemas.ts <dir>`. The companion
// plugin runs it before its build, and a test fails when the files and the
// schemas disagree.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hookSchemaFiles } from "../src/hook-io/index.js";

const target = process.argv[2];
if (target === undefined) {
	console.error("usage: write-hook-schemas <dir>");
	process.exit(2);
}
const dir = resolve(target);
mkdirSync(dir, { recursive: true });
const files = hookSchemaFiles();
const names = new Set(files.map((file) => file.name));
for (const stale of readdirSync(dir)) {
	if (stale.endsWith(".schema.json") && !names.has(stale)) rmSync(resolve(dir, stale));
}
for (const file of files) writeFileSync(resolve(dir, file.name), file.content);
console.log(`wrote ${files.length} schemas to ${dir}`);
