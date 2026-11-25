# Servers and launchers

MCP and LSP servers are declared once in the config, in Claude Code's shape, and a server's launcher is
a plain `sh` script in the plugin:

```ts
mcpServers: { mcp: { command: "sh", args: ["${PLUGIN_ROOT}/bin/start-mcp.sh"] } },
lspServers: {
  okfit: {
    command: "sh",
    args: ["${PLUGIN_ROOT}/bin/start-lsp.sh", "--stdio"],
    extensionToLanguage: { ".md": "markdown" },
    diagnostics: true,
  },
},
files: ["share/"],
```

## Rules

- **`${PLUGIN_ROOT}` is the one placeholder.** It is rewritten for each host in a local MCP server's
  `command`, `args`, `env` values and `cwd`, and in an LSP server's `command`, `args`, `env` values and
  `workspaceFolder`. Nowhere else. Never write a host's spelling there, such as
  `${CLAUDE_PLUGIN_ROOT}` or `$CLAUDE_PLUGIN_ROOT`, or a brace-less `$PLUGIN_ROOT`: the build would
  pass it through unrewritten and ship nothing, so it fails the build. Write `${PLUGIN_ROOT}`.
- **A path a server names after `${PLUGIN_ROOT}/` ships** to every host whose servers name it. The path
  ends at whitespace, a quote, a shell metacharacter, `:` or `,`, so `"${PLUGIN_ROOT}/bin:/usr/bin"` in a
  `PATH` names `bin`, and a comma list names each path. A directory ships every file under it, like a
  `files` directory. The path must exist inside the plugin, be written without `.` or `..` segments
  (a directory may end in `/`), and, when it is the whole `command`, be an executable file, not a
  directory. Prefer `command: "sh"` with the launcher in `args`.
- **`files`** ships what no server names, such as data a launcher reads: files, or directories ending in
  `/`.
- **A Copilot MCP server cannot learn the user's project.** It starts in the plugin root, its client offers no
  MCP roots and no variable names the project (Copilot CLI 1.0.92, measured 2026-10-07), so
  `server_project_dir` returns 1 there. Design such a server to take the project from its tool arguments. A
  Claude Code server gets `CLAUDE_PROJECT_DIR`, starts in the project and can ask for roots.
- **Never put a `cwd` on a Claude MCP server.** Claude ignores it and starts the server in the project,
  so the build fails. Set `cwd` under `copilot.mcpServers`, or `cd` in the launcher.
- **Copilot has no LSP `workspaceFolder` or `settings`.** Setting either fails the Copilot build; give
  that server a Copilot copy without them under `copilot.lspServers`.
- **`PLUGINFINITY_` env keys are reserved.** The build adds `PLUGINFINITY_HOST`, `PLUGINFINITY_PLUGIN`
  and `PLUGINFINITY_LIB` to every local server's `env`.
- **Biome warns `noTemplateCurlyInString`** on `"${PLUGIN_ROOT}/..."` in the config. It is a warning, and
  the string is meant literally: keep it a plain string, never a template literal. To silence it, put
  `// biome-ignore lint/suspicious/noTemplateCurlyInString: pluginfinity placeholder` on the line
  above, or turn the rule off for `pluginfinity.config.ts` in a Biome `overrides` entry. A monitor `command`
  that holds `${PLUGIN_ROOT}` needs the same ignore.

## The launcher

Write the launcher on the server library, which finds the project and the package manager on each host. The functions, the rules a launcher must keep and how to test one are in the `bash-hooks` skill's scripts outside hooks (the `bash-hooks` skill's `references/scripts.md`). Every server field and the per-host overrides are in [the config](config.md), and what each host does with a field is in [what each host gets](targets.md#servers).
