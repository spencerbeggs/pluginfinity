#!/usr/bin/env node
// The `pluginfinity` bin: run the CLI front end, naming this package as the
// distribution it was installed through so `--version` says so. The
// `@pluginfinity/cli/main` import stays external in the build: this shim is not a
// rebuild of the front end.

// A workspace plugin runs this file from source, and linked siblings resolve to
// their `src/`, which needs tsx. A direct run of the bin (a plugin's build
// script, a test's spawn) gets no `nodeOptions`, so it registers tsx here,
// before anything resolves a sibling. A built `.js` bin never takes this
// branch. tsx is the workspace root's alone, and the specifier is computed
// because rolldown inlines a literal, or a const it can fold, into the package.
if (import.meta.url.endsWith(".ts")) {
	const tsx = ["tsx", "esm", "api"].join("/");
	const { register } = (await import(tsx)) as { readonly register: () => void };
	register();
}

const { main } = await import("@pluginfinity/cli/main");
const { PLUGINFINITY_VERSION } = await import("../version.js");

main({ distribution: { name: "pluginfinity", version: PLUGINFINITY_VERSION } });
