// The version define `effected package build` injects. @effected/plugin ships no
// ambient declaration for it, so this package keeps its own until the kit does:
// spencerbeggs/effected#1299, tracked here as #79.
declare namespace NodeJS {
	interface ProcessEnv {
		/**
		 * The built package's version, replaced at build time. Absent when running
		 * unbuilt source, so a reader falls back, e.g. `?? "0.0.0"`.
		 */
		readonly __PACKAGE_VERSION__?: string;
	}
}
