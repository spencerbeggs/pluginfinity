# Migrating a hand-rolled session env

Read this when a plugin writes `CLAUDE_ENV_FILE` or a per-session file of its own. The contract you are moving to is in [session env](session-env.md).

A plugin-bot-era plugin, such as silk with its `source-session-env.sh`, shares values with three pieces: a
`SessionStart` hook that computes them and writes `export` lines to `CLAUDE_ENV_FILE` and to a
`~/.claude/session-env/<session_id>/<plugin>-hook.sh` file of its own, a `source_session_env "$session_id"`
call at the top of every reader hook, and, on Copilot, nothing. Replace all three:

1. **List the variables.** `grep -rn 'CLAUDE_ENV_FILE\|session-env\|source_session_env' hooks scripts skills`
   finds the producer and the readers; every name the producer exports becomes a `vars` entry. Drop names the
   library already answers: the plugin root is `hook_plugin_root`, and the session id is `hook_input session_id`.
   An old fallback becomes the `default`, except under these two rules:
   - **A name whose readers detect a value when it is empty gets `default: ""`.** A non-empty default fills the
     name whenever there is no values file, so the readers' detection never runs.
   - **Never declare a name that works as a deliberate per-command override**, such as a `*_PROJECT_DIR` a user
     sets for one command. Every declared name is resolved and exported, at worst as `""`, and on Claude Code
     appended to `CLAUDE_ENV_FILE`, which pins the model's shell to the session-start value. Leave such a name
     ambient-only: the scripts read it from their environment, as before.
2. **Move the computing into `setup`.** A function such as `detect_package_manager` moves to a script that
   prints `NAME=value` and is named as `env.setup`. A value only a hook can compute stays in that hook, which
   calls `hook_env_set NAME "$value"` instead of writing exports.
3. **Delete the plumbing.** Remove the exports to `CLAUDE_ENV_FILE`, the per-session file, its `grep -q`
   guards and `printf '%q'` quoting, the `source-session-env.sh` helper and every `source_session_env` call.
   Reader hooks use the names directly.
4. **Make skill scripts source `env.sh`.** A script that read `$MYPLUGIN_X` because Claude Code exported it now
   sources `env.sh` with the one line above, which makes it work on Copilot too.
5. **Check `SessionStart` timeouts.** Raise any under 5 seconds.
6. **Rewrite the tests.** Seed values with `--session-env` instead of writing `~/.claude/session-env/` files,
   and run every reader on both targets.
7. **Build and read the notes.** Copilot lists `env-shell-unsupported`; `env-wait-timeout` means step 5 is not
   done.

Behaviour that changes:

- The old reader sourced every `*hook*.sh` file in the session directory, other plugins' included. `env.sh`
  reads this plugin's declared names only, so a value another plugin exported no longer leaks in.
- The old files were shell code, sourced; the new ones are data, parsed, so a value can no longer run anything.
- A project's `.env` and `.env.local` now set declared names, above the setup script.
- Copilot gets the values in hooks and in skill scripts that source `env.sh`, where it got nothing before.
