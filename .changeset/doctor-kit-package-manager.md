---
"@pluginfinity/engine": patch
"@pluginfinity/cli": patch
"pluginfinity": patch
---

## Bug Fixes

`pluginfinity doctor` now detects the package manager with `@effected/workspaces`. It still searches from the config up to the directory holding `.git`, but a `devEngines.packageManager` or `packageManager` field in `package.json` now names the manager even without a lockfile. A yarn project is still reported as yarn. A `bun.lock` alone no longer names bun unless `package.json` also declares bun.
