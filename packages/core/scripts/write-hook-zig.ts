// Write the hook event types for the native hook library (src/hook-io/zig.ts)
// to a file: `tsx scripts/write-hook-zig.ts <file>`. A test fails when the
// file and the schemas disagree.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hookEventsZig } from "../src/hook-io/index.js";

const target = process.argv[2];
if (target === undefined) {
	console.error("usage: write-hook-zig <file>");
	process.exit(2);
}
writeFileSync(resolve(target), hookEventsZig());
console.log(`wrote ${resolve(target)}`);
