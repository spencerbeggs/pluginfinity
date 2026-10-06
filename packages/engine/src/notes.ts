import type { KnownTargetId } from "@pluginfinity/targets";

/**
 * Every note kind, in the order they are sorted and printed.
 *
 * @public
 */
export const BUILD_NOTE_KINDS = [
	"dropped",
	"degraded",
	"tool-dropped",
	"hook-matcher-runtime",
	"hook-output-ignored",
	"hook-omitted",
] as const;

/**
 * What a target did to something it could not carry as written: `dropped` a
 * field, `degraded` a field into another form (a description suffix or a body
 * section), `tool-dropped` a tool it cannot name, moved a
 * `hook-matcher-runtime` matcher the host ignores into the hook library,
 * noted a script that calls a helper whose output the host ignores
 * (`hook-output-ignored`), or `hook-omitted` an event it lacks whose entries all set `fallback: "omit"`.
 *
 * @public
 */
export type BuildNoteKind = (typeof BUILD_NOTE_KINDS)[number];

/**
 * One info-level fact about a build: something the target dropped, degraded
 * or omitted. A note never fails a build.
 *
 * @public
 */
export interface BuildNote {
	readonly target: KnownTargetId;
	/** Plugin-relative component path (e.g. `agents/okf-docs.md`, `skills/x/SKILL.md`), or `config` for hooks and servers. */
	readonly path: string;
	readonly kind: BuildNoteKind;
	/** The field, tool or event name, e.g. `color`, `ToolSearch`, `Notification`, `lspServers.md.diagnostics`. */
	readonly name: string;
}

/** The path of notes about the config: hooks and servers. */
export const CONFIG_NOTE_PATH = "config";

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Components by path, then the config; within a path, by kind in BUILD_NOTE_KINDS order, then by name.
const order = (a: BuildNote, b: BuildNote): number =>
	Number(a.path === CONFIG_NOTE_PATH) - Number(b.path === CONFIG_NOTE_PATH) ||
	compare(a.path, b.path) ||
	BUILD_NOTE_KINDS.indexOf(a.kind) - BUILD_NOTE_KINDS.indexOf(b.kind) ||
	compare(a.name, b.name);

/** The notes without duplicates, sorted by path (the config last), then kind, then name. */
export const sortNotes = (notes: ReadonlyArray<BuildNote>): ReadonlyArray<BuildNote> => {
	const seen = new Set<string>();
	return notes
		.filter((note) => {
			const key = `${note.target}\0${note.path}\0${note.kind}\0${note.name}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.sort(order);
};
