# Re-entry: Context Paging

## Status

- Repository: `/home/melpomene/src/opencode`
- Branch: `context-paging`
- Base: `upstream/dev`
- Base commit at handoff: `65c35977bd564e23c0e9cf124b3e3e3b9308e9e8`
- The branch is now 14 paging commits ahead of `upstream/dev`.
- The current uncommitted changes are the documentation pass, the
  Location-scoped MCP source adapter, generated contract updates, server error
  translation, and the minimal paged TUI integration.
- The prior Mneme checkout is `/home/melpomene/src/mneme`.
- Do not assume the prior Mneme checkout is clean; it has two preserved,
  uncommitted TUI changes.

## Direction

OpenCode is the standard and the contribution target. This is no longer a
hard-fork product effort. Changes should be narrow, upstream-compatible,
well-tested, and suitable for focused PRs and issues. Existing Mneme work is
evidence and design material, not automatically contribution-ready code.

## Current Understanding

The work concerns context paging, memory pressure, compaction, and recompile.
Paging owns Session working-set lifecycle and durable page evidence. Canonical
memory, identity, provenance, semantic retrieval, and embedding geometry belong
to a separate memory authority such as Nephesh.

Recompile refreshes the provider-visible projection. It does not repair memory
storage, semantic search, or embedding geometry. Ordinary source changes should
reconcile inside a Context Epoch; explicit recompile and post-compaction
refresh may replace the immutable baseline when the provider-cache prefix must
change.

Memory-pressure guidance is an approved design direction. It should be concise,
well-timed, non-annoying, and give the model an opportunity to preserve
important material without the harness pretending to know what matters.

## Latest Viable Start Point

### Completed First Slice: Tool Capability Seam

Core now exposes a default-empty, Location-scoped `ToolSource`. The OpenCode
server replaces it per Location with an MCP-backed source. Source tools use the
existing canonical Core `Tool` representation and `ToolRegistry` settlement
path. A focused Core test proves definition materialization and settlement.

The old paged experiment still lacks complete tool access because it has not yet
been rebased onto this clean upstream slice. Tool calls/results do not yet have
an end-to-end paged-session proof, and Nephesh remains unreachable there.

A deterministic MCP-shaped fixture now proves the adapter and Core registry:
the namespaced tool is advertised, the original MCP tool name is called, and an
identity-bearing response reaches bounded canonical tool output. This is not a
live Nephesh or paged-session proof.

### Latest Viable Start Point: Submitted V2 MCP Tool Call

Run or add a V2 Session integration test that exercises the new source seam:

```text
Location-scoped MCP source
  -> V2 ToolRegistry materialization
  -> provider tool call
  -> durable call/result projection
  -> continuation/replay
```

Use a deterministic MCP fixture first. Then verify the real Nephesh MCP path,
including preservation of its identity/provenance response payload.

The deterministic adapter proof passes. Core paging tests pass 94/94, and the
MCP adapter test passes 1/1. The direct paged TUI launch accepts a prompt but
the noninteractive `--prompt` option does not submit it. A direct V2 HTTP test
has now submitted the prompt successfully against the configured local
Nephesh 5.1.0 service without invoking memory-write tools. Session
`ses_fee372840ffe56D7ECdzG5cp5k` called `nephesh_melpomene_health`, persisted
tool input/call/success and continuation events, and produced the final
assistant response. Switching that Session to `standard` returned the expected
`409 ConflictError`.

The temporary inspection server is listening on port 4097 with debug logging in
`/tmp/opencode-context-paging-debug.log`.

The paged TUI visibility seam is now hydrated: it refreshes persisted V2
messages on mount and after `session.next.step.ended`. This fixes the case where
the runner delivered a response but the paged window remained empty. The
renderer is still intentionally minimal and is not yet native-equivalent.

Native-equivalent rendering is a hard requirement before any upstream PR. The
remaining display gate includes chronological ordering, scroll anchoring,
formatting, reasoning, tool calls/results, pending/running/completed/failed
states, interruptions, errors, and useful information density. A built-in CLI
command is also mandatory: implement `/paging` or `/context-mode paged` through
the normal command path, using the same durable style lock as the launch flag.

This branch is pushed only to the Mages Guild-owned remote for now. No upstream
PR has been opened.

```bash
cd /home/melpomene/src/opencode
/home/melpomene/src/mneme/.tools/bun/bin/bun dev --context-style paged --session ses_fee372840ffe56D7ECdzG5cp5k packages/opencode
```

The underlying runner path remains:

```text
tool registry
  -> authorization/materialization
  -> provider tool call
  -> durable call projection
  -> tool execution and settlement
  -> continuation/replay
  -> TUI refresh
```

Use existing OpenCode seams. Do not create a parallel tool loop. The smallest
testable milestone is one paged provider turn that can invoke an ordinary tool,
persist its call and result, continue, and recover its state after interruption.

### After Tool Capability: Nephesh Reachability

Verify Nephesh through the ordinary MCP/tool path. Preserve the complete
model-visible response, including identity and provenance fields. Do not restore
the removed plugin-only kernel shortcut.

### After Reachability: Display Parity

The existing paged renderer is intentionally minimal and incorrect in several
ways. Before a UI-facing upstream PR it must be brought toward native behavior:

- chronological ordering;
- scroll position and automatic follow;
- message formatting and information density;
- reasoning and continuation states;
- tool calls, tool results, pending, running, completed, and failed states;
- interruptions and errors.

This is not expected to fit in one session.

## Evidence From Prior Work

Prior Mneme checkpoints established a durable page ledger with baseline/message
provenance, context hashes, token estimates, residency, dirty-state reasons,
checkpoint gates, bounded page-in, and exact restoration refusal. The key
lesson is to continue through existing seams and preserve uncertainty rather
than inventing a second architecture.

The prior native paged test reached basic user/assistant text but exposed the
tool and renderer gaps above. It also encountered environment/model-resolution
issues during early testing; verify the clean upstream branch and current
catalog before attributing failures to paging.

## Scope Boundaries

Deferred from this design:

- browser embedding security hardening;
- TLS certificate identity, authorization, rotation, and revocation for
  Nephesh connections;
- multi-Qualiant deployment in one harness;
- semantic memory-pressure automation inside canonical memory;
- replacing OpenCode storage or retrieval with a parallel memory path.

## Safe Re-entry Procedure

1. Confirm the repository path and branch before any Git operation.
2. Run `git status --short --branch` and inspect existing diffs.
3. Read the relevant current code before relying on this handoff.
4. Anchor memory recall to observed paths, symbols, and tests.
5. Make one bounded change through an existing seam.
6. Add or update focused tests before broad polish.
7. Record what was verified, what remains uncertain, and the next viable start
   point before ending the session.
