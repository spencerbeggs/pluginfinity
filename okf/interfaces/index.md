# Interface

* [The pluginfinity command line](cli.md) - The pluginfinity bin's commands, flags, audiences and exit codes: 0 for success, 1 for a finding such as a config error, 64 for a usage error, with stdout reserved for structured output.
* [pluginfinity.config.ts](config.md) - The per-plugin config file, written with defineConfig from the pluginfinity carrier; a name plus one top-level key per enabled target, discovered upward to the .git boundary and decoded strictly.
