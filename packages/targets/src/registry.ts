import type { Target } from "@pluginfinity/core";
import { Schema } from "effect";
import { CLAUDE } from "./claude.js";
import { COPILOT } from "./copilot.js";

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
 * One registry entry: the id, a display name, and the host's description.
 *
 * @public
 */
export interface TargetEntry {
	readonly id: KnownTargetId;
	readonly displayName: string;
	readonly target: Target;
}

/**
 * Every target pluginfinity builds for.
 *
 * @public
 */
export const TARGETS: ReadonlyArray<TargetEntry> = [
	{ id: "claude", displayName: "Claude Code", target: CLAUDE },
	{ id: "copilot", displayName: "GitHub Copilot", target: COPILOT },
];

/**
 * Whether `id` names a known target.
 *
 * @public
 */
export const isKnownTargetId = (id: string): id is KnownTargetId =>
	(KNOWN_TARGET_IDS as ReadonlyArray<string>).includes(id);
