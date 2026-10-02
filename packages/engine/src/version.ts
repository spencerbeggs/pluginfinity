/**
 * The version of `@pluginfinity/engine` this build was made from: the comparable
 * version of a pluginfinity run.
 *
 * @remarks
 * A build-time literal: the bundler replaces `process.env.__PACKAGE_VERSION__`
 * with this package's own version, so this is not a runtime environment read.
 * `"0.0.0"` is the unbuilt-source fallback. Every front end runs the same
 * engine, so this, not a front end's or the carrier's version, is what two
 * reports compare to tell whether the same build produced both.
 *
 * @public
 */
export const ENGINE_VERSION: string = process.env.__PACKAGE_VERSION__ ?? "0.0.0";
