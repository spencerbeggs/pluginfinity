---
"@pluginfinity/engine": patch
---

## Bug Fixes

* `PLUGINFINITY_LIB_VERSION` in a build's generated `host.sh` is now a hash of the script library, not the engine version, so committed builds no longer change on every engine release and only change when a library script does
* `doctor`'s Node.js floor check uses the `@effected/semver` 0.18 comparison API
