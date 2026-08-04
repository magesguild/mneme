# Mneme fork status

Mneme is a hard fork of OpenCode maintained by Mages Guild at
<https://github.com/magesguild/mneme>.

Mneme retains the upstream MIT license and required upstream notices. It is not
the OpenCode project and is not represented as an official OpenCode release.
The inherited internal package and protocol names remain temporarily for
implementation compatibility; they do not make Mneme's runtime state shared
with OpenCode.

Mneme uses separate configuration, state, cache, data, session, database, log,
plugin, skill, and project-identity namespaces. Mneme must never read or write
an OpenCode session or configuration as part of ordinary operation.

The active fork identity is:

- command: `mneme`
- project configuration: `mneme.json` / `mneme.jsonc`
- project resources: `.mneme/`
- global configuration: `~/.config/mneme/`
- releases: <https://github.com/magesguild/mneme/releases>

Provider integrations and inherited protocol/package identifiers may retain
their upstream names where changing them would alter an external contract.
Those names are compatibility surfaces, not claims about product ownership.
