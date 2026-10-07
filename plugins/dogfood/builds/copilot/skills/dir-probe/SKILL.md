---
name: dir-probe
description: >-
  THROWAWAY PROBE, not a real skill. Use only when asked to use the dir-probe skill: it checks whether
  the host tells the model where this skill's own directory is.
---

# Skill directory probe (throwaway)

This skill exists only to measure what the host shows the model about a skill's directory.

Without searching the filesystem or running any command, state the absolute path of the directory that contains this SKILL.md, if it was given to you anywhere in your context, and say where you saw it. Then, using only that path, read `marker.txt` and report its contents. If you were not given the path, say so plainly.
