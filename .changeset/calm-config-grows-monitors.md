---
"@pluginfinity/core": minor
---

## Breaking Changes

* Hook entries carry `failClosed`, and a source `monitors/monitors.json` is rejected. Declare monitors in `pluginfinity.config.ts`; there is no compatibility shim.

## Features

* New `monitors` config component, keyed by name, with the `Monitors` schema exported.
* Targets can describe monitor support and hook matcher and output behavior, which drives the new build notes.
