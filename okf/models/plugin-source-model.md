---
type: DataModel
title: Plugin source model
description: The host-neutral shape of a plugin's source that pluginfinity reads, decodes and builds from — skills, agents, hooks, MCP and LSP servers, shipped files and the config fields that declare them — as designed for the first release.
status: draft
tags:
  - architecture
  - portability
resource: ../../packages/core/src/
sources:
  - id: owner-direction
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-02T00:00:00Z
    title: The Phase 1 design agreed with the repository owner, section by section
  - id: core-config
    resource: ../../packages/core/src/config.ts
    title: BaseConfigFields, ShippedPath and makeTargetSetting
  - id: core-lsp
    resource: ../../packages/core/src/lsp.ts
    title: LspServer, LspServers and LSP_FIELDS
  - id: core-mcp
    resource: ../../packages/core/src/mcp.ts
    title: ServerEnv and the reserved PLUGINFINITY_ prefix
generated:
  by: okfit/claude-code
  at: 2026-10-06T21:43:13Z
  body_sha256: 041251644e4800c633b8cc2cba6d178b5dffdc63199769bdceed272ee551d533
---

# Plugin source model

This is the agreed design for Phase 1 of [the roadmap](../roadmaps/pluginfinity-first-release.md); the schemas land in `@pluginfinity/core` in Phase 2.[^owner-direction] Names follow [Claude Code's vocabulary](../decisions/claude-code-names-are-the-source-vocabulary.md), and the per-host side is the [target description](target-description.md).

## Layout

```text
plugins/<name>/
  pluginfinity.config.ts      name, metadata, targets, hooks, mcpServers, lspServers, files, scripts
  skills/<skill>/SKILL.md      plus any scripts/, references/, assets/
  agents/<agent>.md
  hooks/                      shipped whole; scripts referenced from the config
  bin/                        server launchers, shipped because a server names them (any path works)
```

The first release covers six component kinds: skills, agents, hooks, MCP servers, LSP servers and monitors ([decision](../decisions/monitors-are-a-component.md)). Commands, output styles and themes are out of scope. Runtime content is markdown, JSON and bash only ([decision](../decisions/plugins-carry-no-node-dependencies.md)).

## Skills and agents

- **`Skill`.** Its name is its directory name. It must satisfy the Agent Skills spec rule (1 to 64 characters of `a-z`, `0-9` and `-`, no leading, trailing or doubled hyphen), the strictest of the hosts, and equal the frontmatter `name` when one is set. It holds a `SkillFrontmatter`, a body, and its other files.
- **`Agent`.** Its name is its file stem and must equal the frontmatter `name`, which satisfies both Claude Code (identity by `name`) and Copilot (identity by file name). It holds an `AgentFrontmatter` and a body.
- **Frontmatter** uses Claude Code's field names. An unknown field fails decoding, so a misspelt field never ships silently.
- **`targets` block.** Optional in either frontmatter, keyed by target id. `false` excludes the component from that target; an object holds fields for that host only, including fields Claude Code lacks (`handoffs` for Copilot). The block is always stripped on emit, and an unknown target id fails.
- **Frontmatter is YAML.** It must parse as YAML 1.2. A plain scalar holding a colon and a space does not, and one holding a space and `#` loses the rest of its line to a comment. Claude Code's own reader tolerates both, so fold or quote such values. Frontmatter a target keeps whole is written as the author wrote it; any other is re-serialized in the author's key order, quoting what needs it.
- **A `description` in a target block** replaces the base one for that host, and no field is degraded into it, since the author wrote that host's description. A built `description` over 1,024 characters fails.
- **Support files** in a skill directory are copied verbatim, except `.md` files, which get the same body processing as `SKILL.md`.

## Body constructs

- **Host blocks.** `<!-- pluginfinity:only <id> [<id>…] -->` … `<!-- /pluginfinity:only -->` keeps the enclosed passage for the listed targets and strips it for the rest. Blocks do not nest; an unclosed block or an unknown id fails.
- **Tokens.** `{{tool <name>}}`, `{{agent <name>}}`, `{{skill <name>}}` and `{{plugin_root}}`, on one line (`{{tool <name> | <fallback>}}` writes the fallback text when the target cannot spell the tool; a fallback may not contain `{` or `}`, and only tool tokens take one), write the target's run-time spelling of a tool, an agent id, a skill invocation or the body root ([target description](target-description.md)). They apply to `SKILL.md`, every other `.md` file in a skill directory and agent bodies, after host blocks, and are replaced everywhere, code included. Only a `{{` followed by one of those kinds is a token, so `${{ … }}`, Jinja and Handlebars pass through; `\{{` before a token writes it literally. A token a target cannot spell fails the build for that target, and a host block is the escape hatch.
- **References.** An inline link `[text](pluginfinity://skill/<skill>[/<path>][#anchor])` or `[text](pluginfinity://agent/<agent>)` must name a component, and a file, that the target builds. Each target builds it in its reference style. Both forms pass the repository's markdownlint config. A skill link may carry an anchor; an agent link may not. Any other `pluginfinity://` outside code, a reference definition, an autolink or a bare URL in any case, fails the build rather than ship unbuilt.
- **Code is text.** A host-block marker or a reference inside fenced code or an inline code span is shown, not acted on; tokens are the exception. An indented code block is not treated as code.

Why both are built per target, and why explicitly, is in [the decision](../decisions/body-tokens-and-links-are-built-per-target.md).

Whole-file overrides per target are out of scope until a plugin needs them.[^owner-direction]

## Config additions

```ts
export default defineConfig({
  name: "pluginfinity-dogfood",
  description: "End-to-end fixture for the pluginfinity CLI",
  author: { name: "C. Spencer Beggs" },
  scripts: { invoke: "bash" },
  hooks: {
    PreToolUse: [{ matcher: "Bash", script: "hooks/guard-bash.sh", timeout: 10 }],
    Stop: [{ command: 'bash "${PLUGIN_ROOT}/hooks/on-stop.sh" --quiet', fallback: "omit" }],
  },
  mcpServers: {
    docs: { type: "http", url: "https://example.com/mcp" },
  },
  claude: true,
  copilot: {
    hooks: { userPromptTransformed: [{ script: "hooks/brief.sh" }] },
  },
});
```

- **Metadata.** `description` is required; `author`, `homepage`, `repository`, `license` and `keywords` are optional. `version` is still copied from `package.json`.
- **A hook entry** has exactly one of `script` (a path from the plugin root) or `command` (a string whose one placeholder is `${PLUGIN_ROOT}`), and optional `matcher`, `args` (with `script` only), `timeout` in seconds and `fallback`. HTTP and prompt hook types are out of scope.
- **`failClosed`** on a hook entry makes a script that fails before answering deny or block instead of failing open. The build hands the event, the fail policy and, where the host ignores the matcher, the matcher to the script as environment variables ([decision](../decisions/entry-facts-travel-as-env.md)).
- **`monitors`** keys kebab-case names to a `script` or `command` entry with a `description` and an optional `when` (`"always"` or `on-skill-invoke:<skill>`). A host with no monitors drops them with a note, and a source `monitors/monitors.json` is a build error.
- **Files a `command` names** as `${PLUGIN_ROOT}/<path>` ship and are checked like `script` paths.
- **The `hooks/` directory** ships whole to every target, so a script can source helpers the config never names, except scripts that only another target's hooks run. Test data belongs outside it. A script outside `hooks/` ships to the targets that run it.
- **`fallback`** says what a target that lacks the event does: `"fail"` (the default) or `"omit"`.
- **`scripts.invoke`.** `"bash"`, the default, emits `bash "<root>/<path>"` and ignores the file mode, because this repository keeps scripts in git without the executable bit and restores it locally. `"exec"` emits the bare quoted path and fails a build whose shipped `.sh` files are not executable in the source.
- **`mcpServers`** uses Claude Code's `.mcp.json` server shape: `command`, `args`, `env` and `cwd`, or `type` (`http` or `sse`) with `url` and `headers`. `${PLUGIN_ROOT}` is the one placeholder, in a local server's `command`, `args`, `env` values and `cwd`.[^core-config]
- **`lspServers`** uses Claude Code's `.lsp.json` server shape: `command` and `extensionToLanguage` (keys start with `.`) are required, and `args`, `env`, `initializationOptions`, `settings`, `workspaceFolder`, `startupTimeout`, `shutdownTimeout`, `restartOnCrash`, `maxRestarts` and `diagnostics` are optional. An unknown key fails, as it stops Claude loading the plugin. `${PLUGIN_ROOT}` is the placeholder in `command`, `args`, `env` values and `workspaceFolder`; `initializationOptions` and `settings` pass through untouched.[^core-lsp]
- **Server `env`** keys starting with `PLUGINFINITY_` are rejected: the build injects `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN` and `PLUGINFINITY_LIB` into every local server.[^core-mcp]
- **Server files ship by discovery.** Every `${PLUGIN_ROOT}/<path>` in those placeholder fields ships to the targets whose merged servers name it, so a launcher only a Copilot override names never reaches Claude. A path that is a server's whole `command` must be executable.
- **`files`** lists plugin-relative files, or directories ending in `/`, that ship to every target, for what discovery cannot see, such as data a launcher reads. An entry must be canonical (no empty, `.` or `..` segment, not the root) and not under `builds/` or `node_modules/`. A target's own `files` ships to that target only. Why the two routes, and the server library launchers source, is in [the decision](../decisions/server-launchers-ship-by-discovery-and-files.md).[^core-config]
- **Target overrides.** A target key's override object grows from `name` to `name`, `hooks`, `mcpServers`, `lspServers`, `monitors` and `files`, typed per target. An event under a target's `hooks` replaces the base entries for that event on that target, `[]` removes them, and a Copilot override uses Claude Code event names, plus `userPromptTransformed` and `errorOccurred`, which only Copilot has. A server under a target's `mcpServers` or `lspServers` replaces the base server of that name.

The current contract, before these additions, is the [config interface](../interfaces/config.md).

[^owner-direction]: conversation with the repository owner, 2026-10-02
[^core-config]: `../../packages/core/src/config.ts`
[^core-lsp]: `../../packages/core/src/lsp.ts`
[^core-mcp]: `../../packages/core/src/mcp.ts`
