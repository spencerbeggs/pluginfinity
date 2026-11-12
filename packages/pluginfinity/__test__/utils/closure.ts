import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ROOT } from "./workspace.js";

/** The fields of a package manifest the closure checks read. */
export interface Manifest {
	readonly name: string;
	readonly version?: string;
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly peerDependencies?: Readonly<Record<string, string>>;
	readonly peerDependenciesMeta?: Readonly<Record<string, { readonly optional?: boolean }>>;
}

/**
 * The workspace packages that run as part of the tool rather than being
 * imported by a host: the carrier, the CLI front end, and the engine, which is
 * only ever installed beneath them. Each one pins the kit exactly so the
 * published closure never moves without a pluginfinity release.
 */
export const TOOL_PACKAGE_DIRS = ["pluginfinity", "cli", "engine"] as const;

/** The packages that install the tool, so they must declare its full peer closure. */
export const INSTALLED_PACKAGE_DIRS = ["pluginfinity", "cli"] as const;

/** The specifier that publishes the catalog's version with no range operator. */
export const EXACT_SPEC = "catalog:effected:exact";

/** `effect`, any `@effect/*` package, or any `@effected/*` kit package. */
export const isEffectFamily = (name: string): boolean =>
	name === "effect" || name.startsWith("@effect/") || name.startsWith("@effected/");

/** Packages whose peers the closure walk follows: the Effect family and this workspace. */
const isTracked = (name: string): boolean => isEffectFamily(name) || name.startsWith("@pluginfinity/");

/** The directory of the workspace package in `packages/<dir>`. */
export const packageDir = (dir: string): string => resolve(ROOT, "packages", dir);

/** Reads the `package.json` in `dir`. */
export const readManifest = (dir: string): Manifest =>
	JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;

/** The Effect-family regular dependencies of `manifest`, as `[name, specifier]` pairs. */
export const effectFamilyDependencies = (manifest: Manifest): ReadonlyArray<readonly [string, string]> =>
	Object.entries(manifest.dependencies ?? {}).filter(([name]) => isEffectFamily(name));

/** Each Effect-family regular dependency of `manifest` not written {@link EXACT_SPEC}. */
export const unpinnedDependencies = (manifest: Manifest): ReadonlyArray<string> =>
	effectFamilyDependencies(manifest)
		.filter(([, spec]) => spec !== EXACT_SPEC)
		.map(([name, spec]) => `${manifest.name}: ${name}@${spec}`);

/** Resolves an installed package's real directory by Node's upward `node_modules` search from `from`. */
const resolvePackageDir = (from: string, name: string): string | undefined => {
	let dir = from;
	for (;;) {
		const candidate = join(dir, "node_modules", name);
		if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
		const up = dirname(dir);
		if (up === dir) return undefined;
		dir = up;
	}
};

/** What {@link peerClosure} found below one installed package. */
export interface PeerClosureReport {
	/** The tracked packages the walk visited, so a caller can assert it saw a real graph. */
	readonly visited: number;
	/** Each required peer the root does not declare, with the packages that need it. */
	readonly missing: ReadonlyArray<string>;
	/** Tracked dependencies that did not resolve from the install. */
	readonly unresolved: ReadonlyArray<string>;
}

/**
 * Walks the installed regular-dependency graph below `rootDir` through the
 * Effect family and this workspace, and reports every non-optional peer one of
 * those packages takes that the root does not declare as a regular dependency.
 * A peer resolves from the package that installs it, so an undeclared one
 * would come from whatever copy a host's tree happens to hold.
 */
export const peerClosure = (rootDir: string): PeerClosureReport => {
	const root = readManifest(rootDir);
	const declared = new Set(Object.keys(root.dependencies ?? {}));
	const visited = new Set<string>();
	const missing = new Map<string, Set<string>>();
	const unresolved: Array<string> = [];

	const walk = (dir: string): void => {
		if (visited.has(dir)) return;
		visited.add(dir);
		const manifest = readManifest(dir);
		for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
			if (manifest.peerDependenciesMeta?.[peer]?.optional === true) continue;
			if (!isTracked(peer) || declared.has(peer)) continue;
			const needers = missing.get(peer) ?? new Set<string>();
			needers.add(`${manifest.name}@${manifest.version ?? "?"}`);
			missing.set(peer, needers);
		}
		for (const name of Object.keys(manifest.dependencies ?? {})) {
			if (!isTracked(name)) continue;
			const child = resolvePackageDir(dir, name);
			if (child === undefined) unresolved.push(`${manifest.name} -> ${name}`);
			else walk(child);
		}
	};

	for (const name of declared) {
		if (!isTracked(name)) continue;
		const child = resolvePackageDir(rootDir, name);
		if (child === undefined) unresolved.push(`${root.name} -> ${name}`);
		else walk(child);
	}

	return {
		visited: visited.size,
		missing: [...missing].map(([peer, needers]) => `${peer} <- ${[...needers].sort().join(", ")}`).sort(),
		unresolved,
	};
};
