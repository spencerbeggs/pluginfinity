# @pluginfinity/targets

[![npm](https://img.shields.io/npm/v/@pluginfinity%2Ftargets?label=npm&color=cb3837)](https://www.npmjs.com/package/@pluginfinity/targets)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

The hosts [pluginfinity](https://github.com/spencerbeggs/pluginfinity) builds for (`claude` and `copilot` so far), kept as data, and the full config schema assembled from them.

> **Under development.** This package is part of [pluginfinity](https://www.npmjs.com/package/pluginfinity), which is in early `0.x` development. It installs and runs, but pluginfinity does not build plugins yet, and this package's contents will change without notice between `0.x` releases.

## Install pluginfinity instead

To build agent plugins, or to write a `pluginfinity.config.ts`, install the `pluginfinity` package. It provides the command and the `defineConfig` helper.

```bash
pnpm add -D pluginfinity
```

This package is an internal layer of the pluginfinity CLI. It is published so that `pluginfinity` installs, not as an API: nothing it exports is supported for direct import, and only what the `pluginfinity` package exports carries a stability promise.

## License

[MIT](LICENSE)
