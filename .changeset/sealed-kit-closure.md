---
"pluginfinity": patch
---

## Build System

pluginfinity now pins Effect and every `@effected/*` package it runs on to an exact version, across the CLI and the build engine as well as the `pluginfinity` package itself. Installing pluginfinity in a project that uses a different Effect or `@effected` release no longer lets a newer kit patch slip into pluginfinity's own copies. Each pluginfinity version now runs exactly the kit it was tested with, beside whatever versions the project uses.
