export * as SessionPagedLedger from "./paged-ledger"

import { createHash } from "node:crypto"
import { desc, eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import type { Database } from "../database/database"
import { EventV2 } from "../event"
import { SessionPagedLedgerTable } from "./sql"
import type { SessionSchema } from "./schema"

type DatabaseService = Database.Interface["db"]

/** Dirty-state vocabulary; unclassified is the honest default until a future
 * authoring/checkpoint policy can classify working material more precisely. */
export const DirtyState = Schema.Literals([
  "unclassified",
  "checkpointed",
  "unsaved_observation",
  "new_decision",
  "unresolved_uncertainty",
  "tool_result_pending",
  "private_unapproved",
  "summary_pending",
])
export type DirtyState = typeof DirtyState.Type

type Observation = {
  readonly sessionID: SessionSchema.ID
  readonly baselineSeq: number
  readonly messageSeqs: ReadonlyArray<number>
  readonly context: string
  readonly estimatedTokens: number
  readonly contextLimit: number
}

export const contentHash = (context: string) => createHash("sha256").update(context).digest("hex")

/** Record a provider-bound context candidate without storing its contents. */
export const observe = Effect.fn("SessionPagedLedger.observe")(function* (
  db: DatabaseService,
  observation: Observation,
) {
  const messageSeqs = observation.messageSeqs.toSorted((a, b) => a - b)
  const row = yield* db
    .insert(SessionPagedLedgerTable)
    .values({
      id: EventV2.ID.create(),
      session_id: observation.sessionID,
      baseline_seq: observation.baselineSeq,
      first_message_seq: messageSeqs[0],
      last_message_seq: messageSeqs.at(-1),
      content_hash: contentHash(observation.context),
      estimated_tokens: observation.estimatedTokens,
      context_limit: observation.contextLimit,
    })
    .returning({ id: SessionPagedLedgerTable.id })
    .get()
    .pipe(Effect.orDie)
  return row.id
})

export const pageOut = Effect.fn("SessionPagedLedger.pageOut")(function* (
  db: DatabaseService,
  id: EventV2.ID,
  reason: string,
) {
  yield* db
    .update(SessionPagedLedgerTable)
    .set({ residency: "paged_out", dirty_state: "checkpointed", page_out_reason: reason })
    .where(eq(SessionPagedLedgerTable.id, id))
    .run()
    .pipe(Effect.orDie)
})

export const pageIn = Effect.fn("SessionPagedLedger.pageIn")(function* (
  db: DatabaseService,
  id: EventV2.ID,
  reason: string,
) {
  yield* db
    .update(SessionPagedLedgerTable)
    .set({ residency: "resident", page_in_reason: reason })
    .where(eq(SessionPagedLedgerTable.id, id))
    .run()
    .pipe(Effect.orDie)
})

export const latestPagedOut = Effect.fn("SessionPagedLedger.latestPagedOut")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  return yield* db
    .select()
    .from(SessionPagedLedgerTable)
    .where(eq(SessionPagedLedgerTable.session_id, sessionID))
    .orderBy(desc(SessionPagedLedgerTable.time_created))
    .all()
    .pipe(
      Effect.orDie,
      Effect.map((rows) => rows.find((row) => row.residency === "paged_out")),
    )
})
