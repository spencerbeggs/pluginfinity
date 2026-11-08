---
"pluginfinity": patch
---

## Build System

The package is now built with `effected package build` instead of `@savvy-web/bundler`. The published files, exports and dependencies are unchanged. The `pluginfinity` bin registers tsx only when it runs from TypeScript source inside this repository's workspace. In an installed package that branch never runs, and `--version` still reports the release version.
