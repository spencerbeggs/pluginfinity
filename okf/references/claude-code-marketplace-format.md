---
type: Reference
title: Claude Code marketplace format
description: The fields, plugin source types, strict-mode rules and version resolution of a Claude Code `.claude-plugin/marketplace.json`, and what they require of a plugin folder a marketplace lists.
status: draft
tags:
  - portability
stale_after: 2027-01-01T00:00:00Z
sources:
  - id: schemastore-marketplace
    resource: https://www.schemastore.org/claude-code-marketplace.json
    title: Claude Code Plugin Marketplace JSON Schema
    last_modified: 2026-10-02T00:00:00Z
  - id: docs-create-marketplace
    resource: https://code.claude.com/docs/en/plugin-marketplaces.md
    title: Create a marketplace
    last_modified: 2026-10-02T00:00:00Z
  - id: docs-marketplace-reference
    resource: https://code.claude.com/docs/en/plugins/marketplace-reference.md
    title: Marketplace reference
    last_modified: 2026-10-02T00:00:00Z
  - id: docs-plugin-loading
    resource: https://code.claude.com/docs/en/plugins/loading.md
    title: Plugin loading reference
    last_modified: 2026-10-02T00:00:00Z
  - id: docs-host-marketplace
    resource: https://code.claude.com/docs/en/plugins/host-marketplace.md
    title: Host and maintain a marketplace
    last_modified: 2026-10-02T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-02T22:08:02Z
  body_sha256: d54f96549b3e7e12580817841fdf8e7cd00b41007a21c5e4fca929d24fe83dbc
---

# Claude Code marketplace format

A Claude Code plugin marketplace is a directory or repository with a `.claude-plugin/marketplace.json` file that lists plugins and where to fetch each one.[^docs-create-marketplace] This page mirrors the documentation and the SchemaStore JSON Schema (`$id` `https://json.schemastore.org/claude-code-marketplace.json`, draft-07, `$comment` "Generated on 2026-04-23T05:09:42.045Z").[^schemastore-marketplace] pluginfinity does not write marketplace files; the sections that matter to it are [What this constrains in a built plugin](#what-this-constrains-in-a-built-plugin) and [Docs vs schema discrepancies](#docs-vs-schema-discrepancies).

## File location and marketplace root

- The file lives at `.claude-plugin/marketplace.json`. The directory that contains `.claude-plugin/` is the marketplace root, and every relative plugin source resolves from the root, not from `.claude-plugin/`.[^docs-marketplace-reference]
- A file kept elsewhere in the repository must be declared in `extraKnownMarketplaces` with `path` set on its source; `claude plugin marketplace add` has no option for it.[^docs-marketplace-reference]
- A `file` marketplace source reads the file in place and takes the directory two levels up as the root. A `github` or `git` marketplace source's `path` defaults to `.claude-plugin/marketplace.json`.[^docs-marketplace-reference]
- Claude Code ignores unknown top-level or plugin-entry keys rather than rejecting them. `claude plugin validate` reports each as the warning `Unknown field 'x'. Claude Code ignores it at load time.`[^docs-marketplace-reference]
- Each user registers one marketplace per `name`.[^docs-marketplace-reference]
- The install id is `<entry-name>@<marketplace-name>`.[^docs-create-marketplace]

## Top-level fields

`name`, `owner`, and `plugins` are required by both the docs and the schema.[^docs-marketplace-reference][^schemastore-marketplace]

| Field | Type | Required | Notes |
| :- | :- | :- | :- |
| `name` | string | yes | Letters, digits, `.`, `_`, `-`; starts with a letter or digit; no `..`. Forms the part after `@` of every plugin id. See [Reserved names](#reserved-names). Schema: `minLength: 1`, no pattern |
| `owner` | object | yes | Maintainer information. `owner.name` (string, required, schema `minLength: 1`); `owner.email` (string, optional); `owner.url` (string, optional) |
| `plugins` | array | yes | Plugin entries. Each entry is validated on its own, so one invalid entry does not fail the marketplace |
| `$schema` | string | no | JSON Schema URL for editor autocomplete. Ignored at load time |
| `description` | string | no | Shown to users. `claude plugin validate` warns when missing |
| `version` | string | no | Marketplace manifest version |
| `metadata.description` | string | no | Alternate location for `description` |
| `metadata.version` | string | no | Alternate location for `version` |
| `metadata.pluginRoot` | string | no | Directory that bare plugin source names resolve under. Must be a relative path inside the marketplace. Claude Code v2.1.239 or later |
| `forceRemoveDeletedPlugins` | boolean | no | When `true`, a plugin removed from `plugins` is uninstalled on users' machines |
| `allowCrossMarketplaceDependenciesOn` | array of strings | no | Marketplace names whose plugins may be installed as dependencies. Only the list in the installed plugin's own marketplace applies, for its whole dependency chain |
| `renames` | object | no | Map from a former plugin `name` to its current name, or to `null` for a removed plugin. Claude Code v2.1.193 or later. Docs only; not in the schema |

Sources for the table: the docs reference and the schema.[^docs-marketplace-reference][^schemastore-marketplace]

### Reserved names

A marketplace cannot use these names:[^docs-marketplace-reference]

- Official names: `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `anthropic-agent-skills`, `life-sciences`, `knowledge-work-plugins`, `claude-for-legal`, `claude-for-financial-services`, `financial-services-plugins`, `first-party-plugins`, `claude-tag-plugins`. Reserved unless the marketplace comes from a `github` or `git` marketplace source under `github.com/anthropics/`.
- Community names `claude-community`, `claude-plugins-community`, `healthcare`, and directory names `anthropic-plugin-directory`, `claude-plugin-directory`, under the same rule.
- Names that impersonate an official marketplace, such as `official-claude-plugins` or `claude-plugins-v2`, and any name containing a non-ASCII character.
- Another spelling of a reserved name: differing only by a trailing dot, or by a symbol other than `_` in place of `-` (`claude.code.plugins` counts as `claude-code-plugins`). Claude Code v2.1.280 or later.
- `inline` (`--plugin-dir`), `builtin`, `skills-dir`, `synced`, and `claude-plugin-test`.
- `npm`, `pip`, `uv`, `cargo`, `github`, `gh`, in any casing. Claude Code v2.1.275 or later.
- Names starting with `claudeai-`.
- Claude Desktop additionally rejects `org`, `org-provisioned`, `unknown`, and names over 128 characters; `claude plugin validate` reports these as warnings.

Exact official names pass `claude plugin validate`; Claude Code refuses them when the marketplace is added.[^docs-create-marketplace]

## Plugin entry fields

Each object in `plugins` needs `name` and `source`.[^docs-marketplace-reference][^schemastore-marketplace] Apart from the directory listing fields, an entry also accepts every `plugin.json` field.[^docs-marketplace-reference]

### Entry-specific fields

| Field | Type | Required | Notes |
| :- | :- | :- | :- |
| `name` | string | yes | Letters, digits, `.`, `_`, `-`; starts with a letter or digit. Typed before `@` at install, even when `plugin.json` sets a different `name`. Schema: `minLength: 1`, described as "Unique identifier matching the plugin name" |
| `source` | string or object | yes | See [Plugin sources](#plugin-sources) |
| `description` | string | no | Shown in `/plugin` listings and details |
| `version` | string | no | When `plugin.json` also sets `version`, `plugin.json` wins and `claude plugin validate` warns. Schema describes it as semver |
| `category` | string | no | Free-form |
| `tags` | array of strings | no | Free-form, for search |
| `strict` | boolean | no | Default `true`. See [Strict mode](#strict-mode) |
| `relevance` | object | no | When Claude Code suggests the plugin; must contain `topic` and `signals`. Docs only |
| `dependencies` | array | no | Items are `"name"`, `"name@marketplace"`, or an object. Schema string pattern `^[A-Za-z0-9][-A-Za-z0-9._]*(@[A-Za-z0-9][-A-Za-z0-9._]*)?(@\^[^@]*)?$`; object form `{ name (required), marketplace }`, each matching `^[A-Za-z0-9][-A-Za-z0-9._]*$`. Bare names resolve against the declaring plugin's own marketplace |
| `defaultEnabled` | boolean | no | Default `true`. Entry value takes precedence over `plugin.json`. Docs only |
| `displayName` | string | no | Falls back to `name` when neither entry nor `plugin.json` sets it. Docs only |
| `metadata` | object | no | Free-form; Claude Code does not read it. Claude Code v2.1.222 or later. Docs only |
| `headers` | object | no | HTTP headers for an `archive` download; overrides same-named marketplace-source headers. v2.1.238 or later. Docs only |
| `headersHelper` | string | no | Command printing archive-download headers as one JSON object. Entry must also set `"strict": false`. v2.1.238 or later. Docs only |

Sources for the table: the docs reference and the schema.[^docs-marketplace-reference][^schemastore-marketplace]

### plugin.json fields accepted on an entry

The schema lists these manifest fields on an entry: `$schema`, `author` (object, `name` required, optional `email`, `url`), `homepage` (string, `format: uri`), `repository`, `license`, `keywords`, `commands`, `agents`, `skills`, `outputStyles`, `themes`, `hooks`, `mcpServers`, `lspServers`, `userConfig`, `channels`, `monitors`, `settings`.[^schemastore-marketplace]

| Group | Fields | Applies when `plugin.json` is present? |
| :- | :- | :- |
| Component fields | `commands`, `agents`, `skills`, `hooks`, `outputStyles`, `themes` | Governed by `strict` |
| Manifest-only fields | `mcpServers`, `lspServers`, `userConfig`, `channels` | No. Declare them in `plugin.json` |
| Display fields | `displayName`, `description`, `author`, `homepage`, `repository`, `license`, `keywords` | Yes. An entry value wins over `plugin.json`; an unset entry field shows the `plugin.json` value |

Sources for the table: the docs reference.[^docs-marketplace-reference]

Schema path patterns for component fields: every path must match `^\./.*`; `agents` paths and `.md`-variant `commands` paths must also match `.*\.md$`; `monitors` as a path must match `.*\.json$`. `commands` may also be an object mapping command names to `{ source, content, description, argumentHint, model, allowedTools }`.[^schemastore-marketplace]

Entry `hooks` must be an inline object mapping hook event names to matcher arrays. A file path or array passes validation, never runs, and the plugin reports `not yet supported in a marketplace entry`.[^docs-marketplace-reference]

Before install, Claude Code can read `plugin.json` only for relative-path entries. For any other source type, users see only the entry's own fields until install.[^docs-marketplace-reference]

## Strict mode

`strict` matters only when the fetched plugin has its own `.claude-plugin/plugin.json` and the entry declares a component field.[^docs-marketplace-reference]

| `strict` | `plugin.json` | Entry component fields | Result |
| :- | :- | :- | :- |
| any | absent | any | The entry is the manifest. Every manifest field the entry accepts applies, including `mcpServers`, `lspServers`, `userConfig`, `channels` |
| `true` (default) | present | any | `plugin.json` is the authority. Entry component fields are appended to it, except `hooks`, whose matchers replace the manifest's per event |
| `false` | present | none | `plugin.json` is the manifest, as with `true` |
| `false` | present | one or more | Conflict. Fails to load with `Plugin <name> has conflicting manifests: both plugin.json and marketplace entry specify components` |

Sources for the table: the docs reference.[^docs-marketplace-reference]

## Plugin sources

`source` is either a relative path string or an object whose own `source` key names the type.[^docs-marketplace-reference]

| Type | Fields | Required | Notes |
| :- | :- | :- | :- |
| Relative path | the string | — | Directory inside the marketplace, resolved from the root. Must start with `./`, except `"."` (the root itself) or a bare name under `metadata.pluginRoot`. No `..`; forward slashes only on macOS and Linux |
| `github` | `repo`, `ref`, `sha` | `source`, `repo` | `repo` is `owner/repo` |
| `url` | `url`, `ref`, `sha` | `source`, `url` | Full git URL: `https://`, `http://`, `file://`, or `git@`. `.git` suffix not required. No `owner/repo` shorthand |
| `git-subdir` | `url`, `path`, `ref`, `sha` | `source`, `url`, `path` | `url` is a git URL or `owner/repo`. Only `path` is checked out (sparse, partial clone `--filter=tree:0`). Schema: `path` `minLength: 1` |
| `npm` | `package`, `version`, `registry` | `source`, `package` | See below |
| `archive` | `url`, `sha256` | — | Zip over HTTPS. v2.1.224 or later. Docs only |
| `command` | `command`, `timeout`, `mode` | — | Directory printed by a command run on the user's machine. v2.1.229 or later. Docs only |

Sources for the table: the docs reference and the schema.[^docs-marketplace-reference][^schemastore-marketplace]

Shared git fields (`github`, `url`, `git-subdir`): `ref` is a branch or tag, defaulting to the repository default branch; `sha` is a full 40-character lowercase commit SHA (schema pattern `^[a-f0-9]{40}$`). With both set, `sha` is checked out.[^docs-marketplace-reference][^schemastore-marketplace]

- **Bare names**: a single directory name with no `/`. With `"pluginRoot": "./plugins"`, `"source": "formatter"` resolves to `./plugins/formatter`. `pluginRoot` has no effect on a `./` source, and `team-a/formatter` still needs `./`.[^docs-marketplace-reference]
- **Relative paths need the marketplace's files**: they resolve for `github`, `git`, `file`, and `directory` marketplace sources; not for a `url` marketplace source (only `marketplace.json` is fetched); and are rejected for a `settings` source.[^docs-marketplace-reference]
- **npm**: `package` is a registry name, a name with `@version` appended, or an `https` tarball link. `version` is a version, semver range, or dist-tag, used only when `package` has no version appended; omitted means `latest`. `registry` must be `https` unless it is the user's own default registry. Refused `package` values: git addresses, folder or `file:` paths, `npm:` aliases, tarball links on github.com, gist.github.com, gitlab.com (except `gitlab.com/api/v4/`), bitbucket.org, git.sr.ht, and `http` tarball links not on the user's default registry. A `package` containing `..` is `Invalid input`. Fetched with the user's npm client; install scripts never run and dependencies are not installed during the fetch.[^docs-marketplace-reference]
- **archive**: `url` must be `https://` and not a loopback, link-local, or cloud-metadata host. The plugin root may be at the top of the zip or one directory down. `sha256` is 64 hex characters, either case; a mismatch is refused.[^docs-marketplace-reference]
- **command**: `command` prints the plugin directory's absolute path as exactly one line and exits 0; printable ASCII, at most 500 characters, no run of four or more spaces; run through `sh` (or `cmd.exe`) from the home directory. `timeout` is 1 to 600 seconds, default 60. `mode` is `copy` (default) or `link`. Copy mode fails above 256 MiB or 20,000 entries. Link mode is refused on Windows and skips the Node.js dependency install.[^docs-marketplace-reference]

Marketplace source types (where the `marketplace.json` itself comes from) are separate: `url`, `github`, `git`, `npm` (not implemented), `file`, `directory`, `settings`, plus policy-only `skills-dir`, `hostPattern`, `pathPattern`. In a marketplace source, `url` means a direct link to `marketplace.json`, not a git repository.[^docs-marketplace-reference]

## Version resolution

For every plugin source type except `command`:[^docs-plugin-loading]

1. The `version` in the plugin's manifest (`plugin.json`).
2. Then the `version` in the marketplace entry.
3. Otherwise, by source type:

| Source type | Version when no `version` field is set |
| :- | :- |
| `github`, `url`, `git-subdir` | Commit SHA shortened to 12 characters; `git-subdir` also carries a hash of the subdirectory path |
| `archive` | SHA-256 digest shortened to 12 characters (the `sha256` pin, or the downloaded file's digest) |
| Relative path in a Git-hosted marketplace | Commit SHA of the installed directory |
| Local directory, neither plugin nor marketplace a git repository | `unknown` |
| `npm` | `unknown` |

Sources for the table: the loading reference.[^docs-plugin-loading]

For a `command` source the version is always derived from the output: a 12-character hash, or `<manifest version>-<hash>` when the manifest sets one; the entry `version` is ignored.[^docs-plugin-loading] The version names the cache directory `cache/<marketplace>/<plugin>/<version>/`, and an unchanged computed version means `claude plugin update` does not replace the cached copy. A pinned manifest `version` keeps every user on the cached copy until the string changes; leaving `version` out of both manifest and entry lets git-based installs track commits.[^docs-plugin-loading]

## What this constrains in a built plugin

- **`plugin.json` is optional.** With no `.claude-plugin/plugin.json`, the marketplace entry is the manifest regardless of `strict`.[^docs-marketplace-reference] A built folder that omits `plugin.json` depends on the marketplace entry for every manifest field, including `mcpServers`, `lspServers`, `userConfig`, and `channels`.
- **When `plugin.json` is present, it is the manifest.** Entry `mcpServers`, `lspServers`, `userConfig`, and `channels` do not apply, so a built folder with a `plugin.json` must carry them itself. If the entry uses `strict: false` and declares any component field, the plugin fails to load.[^docs-marketplace-reference]
- **Top-level content.** A `command` source requires plugin content at the printed directory's top level, such as `.claude-plugin/`, `skills/`, `commands/`, `agents/`, or `hooks/`.[^docs-marketplace-reference] An `archive` may hold the plugin root at the top of the zip or one directory down.[^docs-marketplace-reference]
- **Name.** The entry `name` is the install id and settings key; the manifest `name` prefixes skills. When they differ, installing by the manifest name fails with `Plugin "<manifest-name>" not found in marketplace "<marketplace>"`, so keep them equal.[^docs-create-marketplace] Both must use letters, digits, `.`, `_`, `-`, starting with a letter or digit.[^docs-marketplace-reference]
- **Version.** `plugin.json` `version` wins over the entry `version`.[^docs-marketplace-reference] Writing a `version` into a built `plugin.json` freezes users on that cached copy until it changes; omitting it lets git-based sources version by commit SHA, while `npm` and plain local directories resolve to `unknown`.[^docs-plugin-loading]
- **Relative-path placement.** The plugin directory must sit inside the marketplace root, reachable by a `./` path (or bare name under `metadata.pluginRoot`) with no `..` and forward slashes. A missing directory passes validation and fails at install with `Source path does not exist: <path>`.[^docs-create-marketplace][^docs-marketplace-reference]
- **Component paths.** Paths in `plugin.json` or an entry must start with `./` (schema), and Claude Code rejects any that resolve outside the plugin root, follow a symlink outside it, or contain a backslash on macOS and Linux (`path escapes plugin directory`).[^schemastore-marketplace][^docs-plugin-loading]
- **Self-contained folder.** Except for in-place loads (relative-path plugins in a local-directory marketplace, `--plugin-dir`, link-mode `command`), Claude Code copies only the plugin directory into the cache, so files above the plugin root, such as `../shared`, are not found.[^docs-plugin-loading] Symlinks to targets within the plugin are preserved, to elsewhere in the same marketplace are dereferenced, and outside the marketplace are skipped; local-path and copy-mode `command` installs keep only symlinks within the plugin.[^docs-host-marketplace]
- **Node.js dependencies.** Installed into the cached copy only when the plugin root holds `package.json` plus a supported lockfile, checked in order `bun.lock`, `npm-shrinkwrap.json`, `package-lock.json`. `bun.lockb`, `yarn.lock`, and `pnpm-lock.yaml` are skipped. npm lockfiles need `lockfileVersion` 2 or 3; `bun.lock` needs at most 2. Every dependency must be a registry package pinned to an exact version; lifecycle scripts never run; npm `overrides` or Bun `patchedDependencies` disable the install; 60-second timeout. In-place relative-path plugins get no install.[^docs-plugin-loading]
- **npm-source packages.** Use `npm-shrinkwrap.json`, because npm excludes `package-lock.json` from published packages. The package is unpacked without running its install scripts.[^docs-plugin-loading][^docs-marketplace-reference]
- **Git LFS.** Clones never download LFS content, so LFS-tracked plugin files arrive as pointer files.[^docs-host-marketplace]
- **Entry hooks.** If the marketplace entry, not the folder, carries hooks, they must be an inline object; file-based hooks belong in the plugin's `hooks/hooks.json` or `plugin.json`.[^docs-marketplace-reference]

## Docs vs schema discrepancies

The schema was generated 2026-04-23; the docs were read 2026-10-02.[^schemastore-marketplace][^docs-marketplace-reference]

| Topic | Docs | Schema |
| :- | :- | :- |
| Top-level `renames` | Present (v2.1.193 or later) | Absent |
| Entry `relevance`, `defaultEnabled`, `displayName`, `metadata`, `headers`, `headersHelper` | Present | Absent |
| Entry `monitors`, `settings`, `$schema` | Not in the entry table; covered by "every `plugin.json` field" | Present |
| `archive` and `command` sources | Present (v2.1.224 and v2.1.229 or later) | Absent; `source` `anyOf` has only relative path, `npm`, `url`, `github`, `git-subdir` |
| Relative path form | `./…`, `"."`, or bare name under `metadata.pluginRoot` | Pattern `^\./.*` only, so `"."` and bare names fail the schema |
| Marketplace and plugin `name` | Character rules and reserved names | `minLength: 1`, no pattern |
| `strict` meaning | Absent `plugin.json` makes the entry the manifest whatever `strict` is; `false` plus entry components plus a `plugin.json` is a conflict | "Require the plugin manifest to be present in the plugin folder. If false, the marketplace entry provides the manifest." |
| `npm` `package` | Refuses git addresses, folder and `file:` paths, `npm:` aliases, and some tarball hosts | "Package name (or url, or local path, or anything else that can be passed to `npm` as a package)" |
| `url` source `url` | `https://`, `http://`, `file://`, or `git@` | "Full git repository URL (https:// or git@)" |
| Entry `version` | "Version string" | "Semantic version (e.g., 1.2.3) following semver.org specification" |
| Unknown keys | Ignored at load; validate warns | No `additionalProperties: false`, so accepted |

Sources for the table: the docs reference and the schema.[^docs-marketplace-reference][^schemastore-marketplace]

[^schemastore-marketplace]: <https://www.schemastore.org/claude-code-marketplace.json>
[^docs-create-marketplace]: <https://code.claude.com/docs/en/plugin-marketplaces.md>
[^docs-marketplace-reference]: <https://code.claude.com/docs/en/plugins/marketplace-reference.md>
[^docs-plugin-loading]: <https://code.claude.com/docs/en/plugins/loading.md>
[^docs-host-marketplace]: <https://code.claude.com/docs/en/plugins/host-marketplace.md>
