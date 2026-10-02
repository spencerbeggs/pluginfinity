import type { ToolDiscovery } from "@effected/commands";
import type { Layer } from "effect";
import { Cause, ConfigProvider, Effect, Exit, Runtime } from "effect";
import { TestConsole } from "effect/testing";
import { run } from "../../src/cli/run.js";
import { testPlatform } from "./platform.js";
import { fakeTools } from "./tools.js";

/** What a run of the CLI produced. */
export interface CliResult {
	readonly code: number;
	readonly stdout: ReadonlyArray<string>;
	readonly stderr: ReadonlyArray<string>;
}

const exitCode = (exit: Exit.Exit<unknown, unknown>): number =>
	Exit.isSuccess(exit) ? 0 : Runtime.getErrorExitCode(Cause.squash(exit.cause));

/**
 * Run the shipped assembly from `run.ts` over a test platform, an empty
 * config provider (so the host's TERM, CI and agent variables decide
 * nothing) and a fake `ToolDiscovery` where every tool is missing unless
 * `tools` says otherwise. Reads the console lines this run added.
 */
export const runCli = (
	args: ReadonlyArray<string>,
	options: { readonly cwd?: string; readonly tools?: Layer.Layer<ToolDiscovery> } = {},
): Effect.Effect<CliResult> =>
	Effect.gen(function* () {
		const outBefore = (yield* TestConsole.logLines).length;
		const errBefore = (yield* TestConsole.errorLines).length;
		const exit = yield* run(args, {
			version: "1.2.3",
			cwd: options.cwd ?? "/nonexistent-pluginfinity-test-cwd",
			nodeVersion: "24.11.0",
			platform: testPlatform,
			tools: options.tools ?? fakeTools({}),
		}).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})), Effect.exit);
		return {
			code: exitCode(exit),
			stdout: (yield* TestConsole.logLines).slice(outBefore).map(String),
			stderr: (yield* TestConsole.errorLines).slice(errBefore).map(String),
		};
	});
