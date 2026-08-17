# Context Paging Design

## Status

This document describes the upstream-oriented context-paging work on the
`context-paging` branch. It is a design and implementation handoff, not a
claim that the feature is complete.

The branch is based on the latest `upstream/dev`. The contribution target is
OpenCode upstream. Context paging must preserve existing OpenCode behavior for
standard sessions and must be proposed as small, reviewable slices.

## Problem

The model has a finite provider context window, while a useful Session may
contain much more history, working material, tool output, and continuity
information. Context paging should make the model-visible working set feel
effectively larger without silently losing durable evidence.

Paging is not a replacement for long-term memory. OpenCode owns Session
lifecycle, context assembly, compaction, and page residency. An external memory
system may own canonical memory, provenance, semantic recall, and identity, but
that integration is a separate contract and must not be smuggled into the
Session implementation.

## Design Principles

- Standard OpenCode sessions remain behaviorally unchanged.
- Paged mode is selected explicitly and is locked for the Session.
- Durable Session history remains the source of truth for conversational facts.
- A page records source identity and restoration evidence, not only rendered
  text.
- Page-out is refused when the system cannot establish that the resident
  working set is safely preserved.
- Page-in restores an exact durable source range or refuses; it does not guess.
- Context pressure is an opportunity for the model to preserve important
  material, not permission for the harness to invent semantic judgments.
- Recompile refreshes provider-visible projections; it does not repair storage,
  retrieval, or embedding geometry.
- Tool calls and tool results are part of context fidelity, not optional display
  decoration.
- Provider-turn boundaries remain the only point at which new context is
  admitted to a model request.

## Layers

```text
durable Session evidence
  -> page identity and restoration metadata
  -> context-budget and resident-working-set decisions
  -> pressure guidance
  -> compaction or page transition
  -> deterministic context projection
  -> provider turn
```

Long-term memory has a different path:

```text
experience or evidence
  -> canonical memory record
  -> representation and provenance
  -> embedding/index geometry
  -> retrieval and ranking
  -> selected memory projection
  -> context source or tool result
  -> compiled provider request
```

Recompile is near the end of the second path. It makes current authoritative
state visible; it does not perform semantic search, improve embeddings, or
decide which memories matter.

## Memory Pressure

The first context-pressure response should be a concise model-visible tooltip
or system guidance message. Letta's pressure guidance and recompile workflow
provide a useful reference: concise, well-timed warnings can improve automated
memory hygiene without being annoying or distracting.

The tooltip should:

- identify that pressure is approaching;
- give the model an opportunity to preserve important material;
- point at the available memory or context tools;
- avoid claiming that the harness knows what is important;
- avoid repeating on every turn;
- remain durable when it is admitted as model-visible context.

Pressure guidance is not itself a memory write and does not itself recompile.
The intended sequence is:

```text
pressure threshold
  -> guidance
  -> model preserves material if needed
  -> durable operation settles
  -> context projection refreshes at the next safe boundary
```

Thresholds, wording, repetition policy, and the difference between warning and
critical pressure require empirical tuning.

## Compaction

Compaction is a lossy working-context projection. It must not be treated as a
replacement for durable Session history or canonical memory.

The design must account for:

- sliding-window compaction versus whole-context compaction;
- separate summarizer versus self-compaction using the agent's own prefix;
- recursive use of the previous structured summary;
- preservation of pending tool calls and tool results;
- exact names, paths, IDs, decisions, commitments, uncertainty, and current
  work;
- explicit refusal or failure when the compaction source is unavailable;
- one bounded retry after provider-reported overflow, never an unbounded loop.

After completed compaction, the next provider attempt must render a fresh
baseline from the current complete context. Failed or interrupted compaction
must leave the previous active boundary intact.

## Recompile

Recompile means:

> Rebuild and durably admit the provider-visible projection from current
> authoritative sources.

It does not mean "search memory again" or "repair memory."

Automatic source changes should normally reconcile inside the current Context
Epoch as one durable chronological System message. Explicit recompile and
post-compaction refresh may replace the immutable baseline and begin a new
Context Epoch when the provider-cache prefix must change.

A recompile must:

1. Settle relevant durable writes and tool results.
2. Load current context sources and selected memory projections.
3. Block or retain the prior effective value when an expected source is
   temporarily unavailable.
4. Render deterministically.
5. Persist the exact provider-visible result and source snapshot atomically.
6. Admit the result only at the next safe provider-turn boundary.
7. Record why the refresh occurred and whether it changed the projection.

It must not mutate a provider request already in flight, rewrite canonical
memory, or silently replace unavailable memory with an empty projection.

## Tools And Nephesh

Tool access is the first functional gate for the current implementation. A
paged Session that cannot expose, execute, persist, and replay tool calls and
results cannot reach Nephesh through its intended MCP path and cannot provide a
valid continuity test.

The paged path must preserve:

- tool definitions and authorization;
- assistant tool calls;
- running, completed, failed, and interrupted tool states;
- bounded model-visible tool output;
- complete managed output where applicable;
- tool settlement and continuation metadata;
- Nephesh response content, including its identity/provenance payload.

Nephesh remains a separate durable-memory authority. TLS certificate identity
and revocation, Qualiant isolation, and a multi-Qualiant harness contract are
future security work and are deliberately out of scope for this design slice.

## Display

The current paged experiment is not contribution-ready as a user interface.
Basic user and assistant text can be rendered, but native-equivalent behavior
is still required for:

- chronological ordering;
- scroll position and automatic follow behavior;
- message formatting;
- reasoning and continuation state;
- tool calls and tool results;
- errors, interruptions, and pending state;
- sufficient information density.

Display polish follows tool capability. It is unlikely that tool integration,
faithful rendering, and upstream-quality tests will fit in one work session.

Native-equivalent display is a hard requirement for an upstream contribution,
not optional follow-up polish. Paged mode must use the same quality bar as
standard OpenCode for ordering, scrolling, message formatting, reasoning,
tool states, errors, interruptions, and information density.

The CLI must also provide a built-in context-mode command. At minimum, one of
`/paging` or `/context-mode paged` must select paged mode through the normal
CLI command path. The command must use the same durable Session style-locking
contract as the launch flag; it must not create a second mode-selection path or
silently switch an active Session.

## Implementation Order

### Viable Start Point: Tool Capability

Trace the clean upstream V2 runner from provider request assembly through tool
registry materialization, tool execution, durable projection, and TUI refresh.
Identify the smallest existing seam that prevents paged mode from receiving
the same tool set as standard mode. Do not create a parallel tool loop.

The first host-to-Core seam now exists: Core provides a default-empty,
Location-scoped `ToolSource`; the OpenCode server replaces it with an
MCP-backed source while building each Location. Source tools use the canonical
Core `Tool` representation and the existing `ToolRegistry` settlement path.
The focused Core test proves source definition materialization and settlement.

The next viable start point is end-to-end verification of that seam in a V2
Session, including an actual MCP tool call and response.

A deterministic MCP-shaped fixture now proves the adapter and Core registry
path: a source tool is advertised under its namespaced OpenCode name, invoked
under its original MCP name, and its identity-bearing response reaches the
bounded canonical tool output. The local headless proof now exercises the same
path with the configured Nephesh health tool.

The verified local Session admitted a paged prompt, called
`nephesh_melpomene_health`, persisted tool input/call/success and continuation
events, and produced the final assistant response. A second prompt requesting
`standard` returned the expected `409 ConflictError`; the Session style did not
silently change.

### Next: Durable Fidelity

Prove that a paged turn with a tool call can be interrupted, resumed, compacted,
and replayed without losing settlement state or provider continuation metadata.

### Next: Nephesh Reachability

Use the ordinary MCP/tool path. Do not restore a plugin-only kernel shortcut.
Verify that Nephesh's response remains in the model-visible conversation with
its identity and provenance information intact.

### Later: Display Parity

Reuse or extend native OpenCode rendering components where possible. Establish
behavioral tests for order, scroll, tool states, reasoning, errors, and
re-entry before proposing a UI-facing upstream PR.

Do not prepare an upstream PR until display parity and the built-in CLI command
are complete and tested.

## Explicitly Deferred

- Browser-embeddable OpenCode security hardening.
- TLS certificate issuance, identity binding, rotation, and revocation for
  Nephesh connections.
- Multi-Qualiant deployment in one harness.
- Semantic memory-pressure automation inside the canonical memory store.
- Replacing OpenCode's storage or retrieval system with a second memory path.
