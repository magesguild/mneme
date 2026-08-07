# Mneme fork status

Mneme is a hard fork of OpenCode maintained by Mages Guild at
<https://github.com/magesguild/mneme>.

Mneme retains the upstream MIT license and required upstream notices. It is not
the OpenCode project and is not represented as an official OpenCode release.
Mneme may begin with the same version number as the source snapshot from which
it diverged; that number identifies the starting point, not shared release
lineage or an ongoing compatibility promise.

Mneme is an independent product lineage. We are not maintaining a flow of
upstream code back into Mneme, and Mneme changes are not intended to merge back
into the OpenCode project. Any later compatibility work is an explicit,
deliberate port reviewed on Mneme's terms.
The inherited internal package and protocol names remain temporarily for
implementation compatibility; they do not make Mneme's runtime state shared
with OpenCode.

The rebrand is intentionally surface-level. Internal OpenCode package names,
module paths, flags, protocol identifiers, provider IDs, and compatibility
schemas remain legacy names unless a concrete correctness, ownership, or
security need makes changing one compelling. Their presence is not a claim
that Mneme shares OpenCode runtime state.

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
