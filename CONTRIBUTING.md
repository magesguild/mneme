# Contributing to Mneme

Mneme is maintained by Mages Guild as a hard fork. Contributions should make
the Mneme product, its isolation boundary, its continuity, or its compatibility
behavior clearer and safer.

Mneme has its own development lineage. The starting version may match the
source snapshot, but upstream code is not an ongoing merge source and Mneme
changes are not sent back to the upstream project. Compatibility ports, when
needed, are deliberate Mneme changes reviewed against Mneme's boundaries.

## Development

Requirements: Bun 1.3.14. From the repository root:

```bash
bash script/bootstrap.sh
bun dev
```

To run the development server against a directory:

```bash
bun dev <directory>
```

To run the headless API server:

```bash
bun dev serve
```

The repository root deliberately refuses to run tests. Run checks from package
directories instead:

```bash
cd packages/core && bun typecheck
cd packages/opencode && bun typecheck
cd packages/app && bun typecheck
```

When changing the public Protocol or Server HTTP API, run `bun run generate`
from `packages/client`. Never edit generated sources directly.

## Repository boundaries

- `packages/opencode` contains the inherited runtime and server implementation.
- `packages/core` contains shared runtime services and configuration logic.
- `packages/app` contains the shared web interface.
- `packages/plugin` contains the plugin API.
- Mneme-owned user-facing paths and runtime state must use Mneme namespaces.
- Internal OpenCode names remain by default; change them only for a compelling
  correctness, ownership, or security reason.

Do not silently connect Mneme to OpenCode state, configuration, sessions, or
databases. Changes that affect identity, persistence, permissions, providers,
protocols, or release artifacts should document the compatibility decision.

## Style and tests

Follow the repository guidance in `AGENTS.md`. Prefer small, independently
testable changes. Add tests for changed behavior and keep tests focused on the
actual implementation rather than duplicating it.

Before submitting a change, report:

- what changed and why;
- which package-scoped checks were run;
- any compatibility names or deferred surfaces that remain; and
- any uncertainty or recovery path a maintainer should know about.

Use conventional commit messages such as:

```text
fix(core): preserve Mneme state isolation
docs: clarify Mneme release boundaries
test(opencode): cover legacy-state rejection
```

## Design review

For new continuity, paging, memory, or delegation behavior, begin with a
design discussion. Mneme routes work, not selfhood. Delegated work and runtime
injections must preserve provenance, uncertainty, inspectability, consent, and
rollback rather than silently merging context.

See [MNEME_FORK.md](./MNEME_FORK.md) and
[MNEME_NEPHESH_DESIGN.md](./docs/MNEME_NEPHESH_DESIGN.md) before changing
those boundaries.
