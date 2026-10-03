---
"pluginfinity": minor
---

## Features

### bats helper for testing built hooks

The package now ships `bats/pluginfinity.bash`, a bats helper for testing a plugin's built hooks. It provides `run_hook`, a set of assert functions and `hook_fixture`, so hook tests can feed fixture input to a built hook and assert on its output and exit status.
