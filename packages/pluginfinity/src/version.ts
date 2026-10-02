/**
 * The version of the `pluginfinity` package this build was made from, passed down
 * to the front ends as the distribution a bin was installed through.
 *
 * @remarks
 * A build-time literal: the bundler replaces `process.env.__PACKAGE_VERSION__`
 * with this package's own version, so this is not a runtime environment read.
 * `"0.0.0"` is the unbuilt-source fallback.
 */
export const PLUGINFINITY_VERSION: string = process.env.__PACKAGE_VERSION__ ?? "0.0.0";
