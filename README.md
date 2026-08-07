# Mneme

Mneme is the Mages Guild hard fork of an open-source AI coding agent. It is a
distinct harness: it keeps a familiar interaction model while owning its own
CLI, configuration, lifecycle, runtime identity, state, and release boundary.

See [MNEME_FORK.md](./MNEME_FORK.md) for attribution, compatibility boundaries,
and the hard-separation contract.

## Identity

- Command: `mneme`
- Project configuration: `mneme.json` or `mneme.jsonc`
- Project resources: `.mneme/`
- Global configuration: `~/.config/mneme/`
- Releases: <https://github.com/magesguild/mneme/releases>

The rebrand is surface-level by design. Internal OpenCode package names,
module paths, flags, provider IDs, protocol identifiers, and compatibility
schemas remain legacy names unless there is a compelling correctness, ownership,
or security reason to change them. Mneme must still never read or write OpenCode
configuration or runtime state during ordinary operation.
The initial version may match the source snapshot, but Mneme is an independent
line of development rather than a downstream release stream.

## Installation

The bootstrap installer uses the repository's release artifacts and installs
the `mneme` command under `~/.mneme/bin`:

```bash
curl -fsSL https://raw.githubusercontent.com/magesguild/mneme/dev/install | bash
```

To keep the installer from editing shell configuration files:

```bash
curl -fsSL https://raw.githubusercontent.com/magesguild/mneme/dev/install | bash -s -- --no-modify-path
```

Release archive and binary naming remain coupled to the build/release workflow;
check the [release page](https://github.com/magesguild/mneme/releases) for
published artifacts.

## Development

Requirements: Bun 1.3.14. The repository-local bootstrap script installs the
pinned toolchain without changing shell startup files.

```bash
bash script/bootstrap.sh
bun dev
```

Run the headless development server with:

```bash
bun dev serve
```

The repository contains several packages. Run typechecks from the relevant
package directory; tests are intentionally not run from the repository root.

```bash
cd packages/core && bun typecheck
cd packages/opencode && bun typecheck
cd packages/app && bun typecheck
```

When changing the public Protocol or Server HTTP API, regenerate the SDK from
`packages/client` with `bun run generate`. Do not edit generated sources by
hand.

## Design direction

Mneme is the interaction and orchestration layer. Its future continuity work
is designed alongside Nephesh, which owns durable memory, provenance, kernel
records, recovery, and knowledge projections. The current paging and
memory-hygiene design remains explicitly review-required; it is not silently
treated as an implemented runtime contract.

The project is MIT licensed. Upstream notices and third-party attribution are
preserved.

## Documentation

- [Fork status](./MNEME_FORK.md)
- [Mneme/Nephesh design](./docs/MNEME_NEPHESH_DESIGN.md)
- [Contributing](./CONTRIBUTING.md)
- [Release repository](https://github.com/magesguild/mneme)
