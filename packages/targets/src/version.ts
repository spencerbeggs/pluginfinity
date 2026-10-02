/**
 * The version of `@pluginfinity/targets` this build was made from.
 *
 * @remarks
 * A build-time literal: the bundler replaces `process.env.__PACKAGE_VERSION__`
 * with this package's own version, so this is not a runtime environment read.
 * `"0.0.0"` is the unbuilt-source fallback.
 *
 * @public
 */
export const TARGETS_VERSION: string = process.env.__PACKAGE_VERSION__ ?? "0.0.0";
