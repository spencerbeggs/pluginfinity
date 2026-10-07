---
"@pluginfinity/core": minor
---

## Breaking Changes

* Hook entries carry `failClosed`, and a source `monitors/monitors.json` is rejected. Declare monitors in `pluginfinity.config.ts`; there is no compatibility shim. The build error is a `PathConflict` with reason `reserved-monitors-file`.

## Features

* New `monitors` config component, keyed by name, with the `Monitors` schema exported. A monitor's `when` takes the bare skill name, so `on-skill-invoke:a:b` is rejected.
* Targets can describe monitor support and hook matcher and output behavior, which drives the new build notes.
