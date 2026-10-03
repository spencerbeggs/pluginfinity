// Build and validate results, drawn for their audience: one line per target
// for people, one JSON object for agents and CI.

import type { TargetBuild, TargetValidation } from "@pluginfinity/engine";

const counts = (build: TargetBuild): string =>
	`${build.plan.added.length} added, ${build.plan.changed.length} changed, ${build.plan.removed.length} removed`;

/** One line per target build a person reads. */
export const buildLines = (builds: ReadonlyArray<TargetBuild>, check: boolean): ReadonlyArray<string> =>
	builds.map((build) =>
		check
			? `✓ ${build.target}: ${build.out} is up to date`
			: build.plan.clean
				? `✓ ${build.target}: ${build.out} unchanged`
				: `✓ ${build.target}: ${build.out} (${counts(build)})`,
	);

/** The JSON shape of one target build. */
export const buildJson = (build: TargetBuild) => ({
	config: build.config,
	target: build.target,
	out: build.out,
	added: build.plan.added,
	changed: build.plan.changed,
	removed: build.plan.removed,
});

/** One line per target validation a person reads. */
export const validateLines = (validations: ReadonlyArray<TargetValidation>): ReadonlyArray<string> =>
	validations.map(
		(validation) =>
			`✓ ${validation.target}: ${validation.out} ${validation.host === "passed" ? "passed the host check" : "is current (host check skipped)"}`,
	);
