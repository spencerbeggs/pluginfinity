/**
 * The pluginfinity command-line front end.
 *
 * @remarks
 * Side-effect free: importing it builds no runtime and touches no process
 * global. The runnable program is the `./main` export, which the `pluginfinity`
 * package's bin calls.
 *
 * @packageDocumentation
 */

export type { ProgramDeps } from "./cli/program.js";
export { program } from "./cli/program.js";
export type { MainOptions } from "./cli/run.js";
export type { LaunchFacts } from "./commands/shared.js";
