import { describe, expect } from "bun:test"
import { Cause, DateTime, Effect, Exit } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { EventV2 } from "@opencode-ai/core/event"
import { EventSequenceTable, EventTable } from "@opencode-ai/core/event/sql"
import { Project } from "@opencode-ai/core/project"
import { ProjectTable } from "@opencode-ai/core/project/sql"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { SessionPagedLedger } from "@opencode-ai/core/session/paged-ledger"
import { SessionPagedLedgerTable, SessionTable } from "@opencode-ai/core/session/sql"
import { testEffect } from "./lib/effect"

const it = testEffect(AppNodeBuilder.build(LayerNode.group([Database.node])))
const sessionID = SessionV2.ID.make("ses_paged_ledger_test")
const created = DateTime.makeUnsafe(0)
const model = { id: ModelV2.ID.make("model"), providerID: ProviderV2.ID.make("provider") }

describe("SessionPagedLedger", () => {
  it.effect("refuses to mark a missing source range resident", () =>
    Effect.gen(function* () {
      const pageID = EventV2.ID.create()
      const refused = yield* SessionPagedLedger.assertRestoredRange(pageID, 3, 7, undefined, []).pipe(Effect.exit)
      expect(Exit.isFailure(refused)).toBe(true)
      if (Exit.isFailure(refused)) {
        expect(Cause.squash(refused.cause)).toEqual(
          new SessionPagedLedger.PageRestoreRefused({
            id: pageID,
            firstMessageSeq: 3,
            lastMessageSeq: 7,
            reason: "source_range_missing",
          }),
        )
      }

      const mismatch = yield* SessionPagedLedger.assertRestoredRange(pageID, 3, 7, [3, 5, 7], [
        { seq: 3 },
        { seq: 7 },
      ]).pipe(Effect.exit)
      expect(Exit.isFailure(mismatch)).toBe(true)
      if (Exit.isFailure(mismatch))
        expect(Cause.squash(mismatch.cause)).toMatchObject({ reason: "source_sequence_mismatch" })
    }),
  )

  it.effect("classifies unsettled tool evidence without inferring semantic states", () =>
    Effect.gen(function* () {
      const assistant = SessionMessage.Assistant.make({
        id: SessionMessage.ID.make("msg_dirty_state_classifier"),
        type: "assistant",
        agent: "build",
        model,
        content: [
          SessionMessage.AssistantTool.make({
            type: "tool",
            id: "call_1",
            name: "read",
            state: { status: "running", input: {}, structured: {}, content: [] },
            time: { created },
          }),
        ],
        time: { created },
      })

      expect(SessionPagedLedger.classify([assistant])).toEqual({
        state: "tool_result_pending",
        reason: "unsettled_tool_state",
      })
      expect(SessionPagedLedger.classify([SessionMessage.Assistant.make({ ...assistant, content: [] })])).toEqual({
        state: "unclassified",
        reason: "no_authoritative_dirty_state",
      })
    }),
  )

  it.effect("classifies an unfinished durable compaction without inferring authorship", () =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db
        .insert(EventSequenceTable)
        .values({ aggregate_id: sessionID, seq: 0 })
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(EventTable)
        .values({
          id: EventV2.ID.create(),
          aggregate_id: sessionID,
          seq: 0,
          type: "session.next.compaction.started",
          data: {},
        })
        .run()
        .pipe(Effect.orDie)

      expect(yield* SessionPagedLedger.classifyDurable(db, sessionID, [])).toEqual({
        state: "summary_pending",
        reason: "unsettled_compaction",
      })

      yield* db
        .insert(EventTable)
        .values({
          id: EventV2.ID.create(),
          aggregate_id: sessionID,
          seq: 1,
          type: "session.next.compaction.ended",
          data: {},
        })
        .run()
        .pipe(Effect.orDie)
      expect(yield* SessionPagedLedger.classifyDurable(db, sessionID, [])).toEqual({
        state: "unclassified",
        reason: "no_authoritative_dirty_state",
      })
    }),
  )

  it.effect("records provider-bound metadata without storing context contents", () =>
    Effect.gen(function* () {
      const { db } = yield* Database.Service
      yield* db
        .insert(ProjectTable)
        .values({ id: Project.ID.global, worktree: AbsolutePath.make("/project"), sandboxes: [] })
        .run()
        .pipe(Effect.orDie)
      yield* db
        .insert(SessionTable)
        .values({
          id: sessionID,
          project_id: Project.ID.global,
          slug: "paged-ledger",
          directory: "/project",
          title: "paged ledger",
          version: "test",
        })
        .run()
        .pipe(Effect.orDie)

      const context = JSON.stringify({ messages: [{ role: "user", content: "private context" }] })
      const pageID = yield* SessionPagedLedger.observe(db, {
        sessionID,
        baselineSeq: 12,
        messageSeqs: [7, 3, 5],
        context,
        estimatedTokens: 20,
        contextLimit: 100,
        dirtyState: { state: "unsaved_observation", reason: "test-observation" },
      })
      const refused = yield* SessionPagedLedger.pageOut(db, pageID, "compaction").pipe(Effect.exit)
      expect(Exit.isFailure(refused)).toBe(true)
      if (Exit.isFailure(refused)) {
        expect(Cause.squash(refused.cause)).toEqual(
          new SessionPagedLedger.PageOutRefused({ id: pageID, dirtyState: "unsaved_observation" }),
        )
      }
      expect((yield* db.select().from(SessionPagedLedgerTable).all().pipe(Effect.orDie))[0]).toMatchObject({
        dirty_state: "unsaved_observation",
        dirty_state_reason: "test-observation",
        residency: "resident",
        message_seqs: [3, 5, 7],
      })

      yield* SessionPagedLedger.checkpoint(db, pageID, "test-checkpoint")
      yield* SessionPagedLedger.pageOut(db, pageID, "compaction")

      const rows = yield* db.select().from(SessionPagedLedgerTable).all().pipe(Effect.orDie)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        session_id: sessionID,
        baseline_seq: 12,
        first_message_seq: 3,
        last_message_seq: 7,
        estimated_tokens: 20,
        context_limit: 100,
        dirty_state: "checkpointed",
        residency: "paged_out",
        page_out_reason: "compaction",
      })
      expect(rows[0]).not.toHaveProperty("context")
      expect(rows[0]?.content_hash).toBe(SessionPagedLedger.contentHash(context))
      expect((yield* SessionPagedLedger.latestPagedOut(db, sessionID))?.id).toBe(pageID)

      yield* SessionPagedLedger.pageIn(db, pageID, "test-restoration")
      const refusedPageIn = yield* SessionPagedLedger.pageIn(db, pageID, "duplicate-restoration").pipe(Effect.exit)
      expect(Exit.isFailure(refusedPageIn)).toBe(true)
      if (Exit.isFailure(refusedPageIn))
        expect(Cause.squash(refusedPageIn.cause)).toEqual(
          new SessionPagedLedger.PageInRefused({ id: pageID, residency: "resident" }),
        )
    }),
  )
})
