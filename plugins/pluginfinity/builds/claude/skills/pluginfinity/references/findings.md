# Findings

A finding is a problem pluginfinity reports instead of building. It exits 1 with the message on one
line and a hint on the next; under `--agent` or `--ci` it is one JSON object on stdout with `error.tag`,
`error.message` and `error.remediation.hint`. A usage error, such as an unknown flag or `--target`,
exits 64.

## Notes are not findings

`build`, `build --check` and `validate` also list notes: what a host dropped, degraded or omitted. A note
never fails a command or changes its exit code. For people, each target's `✓` line is followed by one
line per file with notes, `· <path>: <kind> <names>; <kind> <names>`. Under `--agent` or `--ci`, each
entry of `builds` or `validations` carries a `notes` array of `{ "path", "kind", "name" }`.

| Kind | Means | What to do |
| :-- | :-- | :-- |
| `dropped` | The host has no such field, so the build left it out. `name` is the field, or `<origin>.<server>.<field>` for a server field under `config` | Nothing, if expected. If the host needs it, set that host's own field in the component's `targets` block |
| `degraded` | The field was moved into another form: a `description` suffix (`when_to_use`, `paths`) or a body section (`skills`) | Nothing. For a description suffix, setting `targets.<id>.description` writes that host's description yourself and clears the note; a body section is reported either way |
| `tool-dropped` | The host has no name for the tool: a Claude-only tool, another plugin's MCP tool, or this plugin's MCP tool on a server that host does not declare | Check the name. For this plugin's own tools write `mcp__plugin_<plugin>_<server>__<tool>`; see [what each host gets](targets.md#tools) |
| `hook-omitted` | The host lacks the event and every entry sets `fallback: "omit"` | Nothing, if the hook is optional on that host |

`path` is the source file (`agents/<name>.md`, `skills/<name>/SKILL.md`), or `config` for hooks and servers.

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
| `ShippedFileInvalid` | A file a server names, or a `files` entry, cannot ship: `missing`, `not-executable` (a whole `command` without the exec bit), `directory` (a whole `command` that is a directory), `outside-root` (it or a symlink under it leaves the plugin) or `not-normal` (a `.`, `..` or empty segment) | Create the file or fix the path; `chmod +x` it or use `command: "sh"` with the path in `args`; name the launcher file, not its directory, as `command`; keep files inside the plugin |
| `PathConflict` | A source file sits where the build writes a generated file, such as `hooks/hooks.json` or Copilot's `mcp.json`, or under the reserved `lib/pluginfinity/` or `hooks/lib/pluginfinity/` | Delete or move the source file |
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
- **A token problem at line N on a host**, such as `{{tool TodoWrite}} has no spelling on this target`,
  `{{plugin_root}}` on Copilot, `this plugin has no agent "x"`, a missing argument or a token never
  closed on its line. Fix the name, or move the passage into a host block for the hosts that can spell
  it. For a literal `{{`, write `\{{`.
- **A `pluginfinity://` problem at line N on a host.** The skill, agent or file does not exist in that
  host's build, an agent link has a path or `#anchor`, or the link is not an inline `[text](…)` link with
  no title: a reference definition, an autolink, an image or a bare URL. Write an inline link, or put a
  sample inside code.
- **A mistyped `targets.<id>.<field>`.** An override is checked like the base field; fix its value.
- **`mcpServers.<name>.cwd` on Claude.** Claude ignores an MCP `cwd`; move it under
  `copilot.mcpServers`, or `cd` in the launcher.
- **`lspServers.<name>.workspaceFolder` or `.settings` on Copilot.** Copilot has neither; set that
  server under `copilot.lspServers` without the field.
- **A host root spelling in a server field**, such as `${CLAUDE_PLUGIN_ROOT}` or a brace-less
  `$PLUGIN_ROOT` in `mcpServers.<name>.args`. Write `${PLUGIN_ROOT}`; the build rewrites it per host.
- **A key starting `claude.` or `copilot.`**, such as `copilot.lspServers.<name>.settings`, names a server
  set under that target's override; fix it there.

## Validating

| Tag | Cause | Fix |
| :-- | :-- | :-- |
| `HostRejected` | A host's own check refused the build: `claude plugin validate` failed, or Copilot did not load the plugin under its manifest name and version | Run the command the hint names to see the host's report; `--no-host` skips host checks |
