# Customizing Mneme

Use this skill only when editing Mneme configuration or Mneme-owned agents,
commands, skills, plugins, MCP servers, or permission rules.

Mneme configuration uses `mneme.json` or `mneme.jsonc` at the project level,
`.mneme/` for project-local resources, and `~/.config/mneme/` for global
resources. Mneme does not read or write OpenCode configuration or state.

Before changing configuration, inspect the relevant schema and preserve the
user's existing structure. After changing configuration, validate it and tell
the user what changed. Do not silently create autobiographical memory,
reinterpret user intent, or widen permissions while configuring Mneme.

When a configuration change is uncertain, state the uncertainty and ask before
making a destructive or scope-widening change.
