# Reference

* [Agent frontmatter across hosts](agent-frontmatter.md) - Agent file naming, frontmatter fields, tool vocabularies and plugin restrictions for Claude Code subagents and GitHub Copilot custom agents, side by side.
* [Claude Code marketplace format](claude-code-marketplace-format.md) - The fields, plugin source types, strict-mode rules and version resolution of a Claude Code \`.claude-plugin/marketplace.json\`, and what they require of a plugin folder a marketplace lists.
* [Claude Code plugin format](claude-code-plugin-format.md) - The on-disk layout, plugin.json manifest fields, component path rules, path variables, hooks shape and install-time copying rules of a Claude Code plugin, as the official docs and the SchemaStore manifest schema state them.
* [GitHub Copilot CLI plugin format](copilot-cli-plugin-format.md) - Layout, manifest fields, component discovery, hooks, marketplace and install behaviour of GitHub Copilot CLI plugins, in both the Agent Plugins 1.0 and legacy formats.
* [Skill frontmatter across hosts](skill-frontmatter.md) - The SKILL.md layout, frontmatter fields, body substitutions and name rules defined by the Agent Skills spec, Claude Code and GitHub Copilot, side by side.
* [claude-binary-plugin prior art](claude-binary-plugin.md) - The owner's earlier Bun and Effect v3 SDK that compiles typed Claude Code hook handlers into one single-file executable per plugin, recorded as prior art for building binary hooks inside pluginfinity.
