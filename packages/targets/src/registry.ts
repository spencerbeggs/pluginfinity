import { Schema } from "effect";

/**
 * The id of every target pluginfinity knows, in registry order. One id names a
 * target everywhere: the config key, `builds/<id>/` and `--target <id>`.
 *
 * @public
 */
export const KNOWN_TARGET_IDS = ["claude", "copilot"] as const;

/**
 * A known target id.
 *
 * @public
 */
export const KnownTargetId = Schema.Literals(KNOWN_TARGET_IDS);

/**
 * The decoded `KnownTargetId`.
 *
 * @public
 */
export type KnownTargetId = typeof KnownTargetId.Type;

/**
 * One registry entry. Only an id and a display name for now; the capability
 * description lands with the core `Target` schema.
 *
 * @public
 */
export interface TargetEntry {
	readonly id: KnownTargetId;
	readonly displayName: string;
}

/**
 * Every target pluginfinity builds for.
 *
 * @public
 */
export const TARGETS: ReadonlyArray<TargetEntry> = [
	{ id: "claude", displayName: "Claude Code" },
	{ id: "copilot", displayName: "GitHub Copilot" },
];

/**
 * Whether `id` names a known target.
 *
 * @public
 */
export const isKnownTargetId = (id: string): id is KnownTargetId =>
	(KNOWN_TARGET_IDS as ReadonlyArray<string>).includes(id);
