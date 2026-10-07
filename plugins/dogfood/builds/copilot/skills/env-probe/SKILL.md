---
name: env-probe
description: >-
  Print the pluginfinity-dogfood session env. Use when asked to use the env-probe skill, to check that
  a skill script sees the session values on this host.
---

# Session env probe

Run `${CLAUDE_PLUGIN_ROOT}/skills/env-probe/scripts/print-env.sh` and report its output. It sources the plugin's `env.sh`, so it prints the session's values on both hosts.
