// Bridge for the Effect 4.1 round: the published toolchain (silk, okfit,
// vitest-agent) and the kit it loads are still built on Effect 4.0.7, which
// exports `Crypto` from the `effect` root that 4.1 removed. Under the
// catalog plugin's graph-wide `effect@4.1.1` override they die at import, so
// run them, and the tools that load them, on the effect they were built on.
// npm aliases slip past the override's version selector. Private workspace
// packages are left alone. Remove once every tool republishes on an
// @effected release built on Effect 4.1 (then no lockfile entry names
// effect@4.0.7).
const BRIDGED = "4.0.7";
const TOOLCHAIN = ["@savvy-web/", "@okfit/", "@tsdoctor/", "@vitest-agent/", "rolldown-pnpm-config"];
const isEffectLine = (name, spec) =>
	(name === "effect" || name.startsWith("@effect/")) && /^[\^~=]*4\./.test(String(spec).trim());
// A kit package is bridged only while it is still built on Effect 4.0: one
// whose effect range is on 4.1 is the kit this workspace itself imports.
const effectSpec = (pkg) => String(pkg.peerDependencies?.effect ?? pkg.dependencies?.effect ?? "").trim();
const isOldKit = (pkg) => pkg.name.startsWith("@effected/") && !/^[\^~=]*4\.[1-9]/.test(effectSpec(pkg));
const reachesKit = (pkg) =>
	[pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies].some((deps) =>
		Object.keys(deps ?? {}).some((name) => name.startsWith("@effected/")),
	);
function readPackage(pkg) {
	if (pkg.private === true || !pkg.name) return pkg;
	const bridged =
		(pkg.version === BRIDGED && isEffectLine(pkg.name, pkg.version)) ||
		isOldKit(pkg) ||
		TOOLCHAIN.some((p) => pkg.name.startsWith(p)) ||
		(!pkg.name.startsWith("@effected/") && reachesKit(pkg));
	if (!bridged) return pkg;
	const pinned = {};
	for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
		for (const name of Object.keys(pkg[field] ?? {})) {
			if (!isEffectLine(name, pkg[field][name])) continue;
			delete pkg[field][name];
			pinned[name] = `npm:${name}@${BRIDGED}`;
		}
	}
	if (Object.keys(pinned).length > 0) pkg.dependencies = { ...pkg.dependencies, ...pinned };
	return pkg;
}
module.exports = { hooks: { readPackage } };
