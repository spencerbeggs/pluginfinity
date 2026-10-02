import { build } from "@savvy-web/bundler";

await build({
	meta: {
		tsdoc: {
			// Effect class factories (Schema.Class, TaggedError, Context.Service)
			// synthesize an anonymous `_base` class that cannot be exported or
			// release-tagged from source; suppress only that warning.
			suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
		},
	},
});
