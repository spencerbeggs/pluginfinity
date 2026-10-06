// Build and validate results, drawn for their audience: one line per target
// for people, with one `·` line per component a target dropped, degraded or
// omitted something from, and one JSON object for agents and CI.

import type { BuildNote, TargetBuild, TargetValidation } from "@pluginfinity/engine";
import { BUILD_NOTE_KINDS } from "@pluginfinity/engine";

const counts = (build: TargetBuild): string =>
	`${build.plan.added.length} added, ${build.plan.changed.length} changed, ${build.plan.removed.length} removed`;

/**
 * One indented line per component, in the notes' order: kinds in
 * `BUILD_NOTE_KINDS` order separated by `; `, names within a kind by `, `.
 */
export const noteLines = (notes: ReadonlyArray<BuildNote>): ReadonlyArray<string> => {
	const byPath = new Map<string, Array<BuildNote>>();
	for (const note of notes) byPath.set(note.path, [...(byPath.get(note.path) ?? []), note]);
	return [...byPath].map(([path, group]) => {
		const kinds = BUILD_NOTE_KINDS.flatMap((kind) => {
			const names = group.filter((note) => note.kind === kind).map((note) => note.name);
			return names.length === 0 ? [] : [`${kind} ${names.join(", ")}`];
		});
		return `  · ${path}: ${kinds.join("; ")}`;
	});
};

/** One line per target build a person reads, each followed by its notes. */
export const buildLines = (builds: ReadonlyArray<TargetBuild>, check: boolean): ReadonlyArray<string> =>
	builds.flatMap((build) => [
		check
			? `✓ ${build.target}: ${build.out} is up to date`
			: build.plan.clean
				? `✓ ${build.target}: ${build.out} unchanged`
				: `✓ ${build.target}: ${build.out} (${counts(build)})`,
		...noteLines(build.notes),
	]);

/** A note's JSON shape: its target is already on the enclosing build. */
const noteJson = ({ path, kind, name }: BuildNote) => ({ path, kind, name });

/** The JSON shape of one target build. */
export const buildJson = (build: TargetBuild) => ({
	config: build.config,
	target: build.target,
	out: build.out,
	added: build.plan.added,
	changed: build.plan.changed,
	removed: build.plan.removed,
	notes: build.notes.map(noteJson),
});

/** One line per target validation a person reads, each followed by its notes. */
export const validateLines = (validations: ReadonlyArray<TargetValidation>): ReadonlyArray<string> =>
	validations.flatMap((validation) => [
		`✓ ${validation.target}: ${validation.out} ${validation.host === "passed" ? "passed the host check" : "is current (host check skipped)"}`,
		...noteLines(validation.notes),
	]);

/** The JSON shape of one target validation. */
export const validateJson = (validation: TargetValidation) => ({
	config: validation.config,
	target: validation.target,
	out: validation.out,
	host: validation.host,
	notes: validation.notes.map(noteJson),
});
