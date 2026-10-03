# Findings

A finding is a problem pluginfinity reports instead of building. It exits 1 with the message on one
line and a hint on the next; under `--agent` or `--ci` it is one JSON object on stdout with `error.tag`,
`error.message` and `error.remediation.hint`. A usage error, such as an unknown flag or `--target`,
exits 64.

## Finding the config

| Tag | Cause | Fix |
| :-- | :-- | :-- |
| `ConfigNotFound` | No `pluginfinity.config.{ts,mts,js,mjs}` at or above the start, or `--config` names a missing file | Run inside the plugin, pass its directory, or fix `--config` |
| `ConfigAmbiguous` | One directory holds two configs | Keep one |
| `ConfigLoadFailed` | Importing the config threw: a syntax error or a bad import | Fix the error the message quotes |
| `ConfigInvalid` | A field has the wrong shape, or no target is enabled | Fix each listed key |
| `UnknownTarget` | A top-level key is neither a config field nor a target | Fix the spelling or remove the key |
| `TargetNotEnabled` | `--target` names a target the config does not enable | Enable it, or drop the flag |

## Building

| Tag | Cause | Fix |
| :-- | :-- | :-- |
| `PackageVersionMissing` | No `package.json` beside the config, or no `version` string in it | Add one |
| `ComponentsInvalid` | One or more skills or agents are wrong; each is listed with its file and, where it applies, the host | Fix each listed file, as below |
| `HookEventUnsupported` | A host lacks a hook event the config uses | Set `fallback: "omit"`, or give that host its own hooks for the event |
| `HookScriptInvalid` | A hook script is missing, or not executable under `scripts.invoke: "exec"` | Create it or fix the path; `chmod +x` it or drop `exec` |
| `PathConflict` | A source file sits where the build writes a generated file, such as `hooks/hooks.json` | Delete or move the source file |
| `BuildStale` | `build --check` or `validate` found `builds/` out of date; the message names every file | Run `pluginfinity build` and commit the result |

Common problems inside `ComponentsInvalid`:

- **An unknown field.** Fix the spelling, or move a host-only field into that host's `targets` block.
- **Not valid YAML, at line N, column M.** Usually a plain value holding `:`; fold or quote it.
- **A plain value holding `#`.** YAML would cut it short; fold or quote it.
- **A name that differs from the directory or file name.** Make them match.
- **A description over 1,024 characters on a host.** Set a shorter one under that host's `targets`
  block.
- **A field the host leaves unresolved.** The message says what to do; usually set the host's own field
  in its `targets` block.
- **A host-block problem at line N.** Close the block, use a known target id, or give the marker its own
  line.

## Validating

| Tag | Cause | Fix |
| :-- | :-- | :-- |
| `HostRejected` | A host's own check refused the build: `claude plugin validate` failed, or Copilot did not load the plugin under its manifest name and version | Run the command the hint names to see the host's report; `--no-host` skips host checks |
