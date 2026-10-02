# @pluginfinity/engine

## 0.0.1

### Features

- First published release, made to claim the package names. pluginfinity is under development: these packages install and run, but they do not build plugins yet.

- `pluginfinity doctor` checks Node.js, the package manager, the targeted host CLIs, bats, git and whether the config loads, with `--strict` for use as a CI gate

- `pluginfinity build`, `validate`, `init` and `plugin add` parse and check their input, then stop with "not implemented yet"

- `defineConfig` types a `pluginfinity.config.ts`, with `claude` and `copilot` as top-level target keys

- The `@pluginfinity/*` packages are internal layers of the `pluginfinity` package and are not a supported API

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @pluginfinity/core | dependency | updated | 0.0.0 | 0.0.1 |
| @pluginfinity/targets | dependency | updated | 0.0.0 | 0.0.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!
