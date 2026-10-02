#!/usr/bin/env node
// The `pluginfinity` bin: run the CLI front end, naming this package as the
// distribution it was installed through so `--version` says so. The
// `@pluginfinity/cli/main` import stays external in the build: this shim is not a
// rebuild of the front end.
import { main } from "@pluginfinity/cli/main";
import { PLUGINFINITY_VERSION } from "../version.js";

main({ distribution: { name: "pluginfinity", version: PLUGINFINITY_VERSION } });
