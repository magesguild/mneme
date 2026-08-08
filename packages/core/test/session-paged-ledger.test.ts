import { describe, expect } from "bun:test"
import { Cause, Effect, Exit } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { Project } from "@opencode-ai/core/project"
import { ProjectTable } from "@opencode-ai/core/project/sql"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionPagedLedger } from "@opencode-ai/core/session/paged-ledger"
import { SessionPagedLedgerTable, SessionTable } from "@opencode-ai/core/session/sql"
import { testEffect } from "./lib/effect"

const it = testEffect(AppNodeBuilder.build(LayerNode.group([Database.node])))
const sessionID = SessionV2.ID.make("ses_paged_ledger_test")

describe("SessionPagedLedger", () => {
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
        dirtyState: "unsaved_observation",
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
        residency: "resident",
      })

      yield* SessionPagedLedger.checkpoint(db, pageID)
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
    }),
  )
})
