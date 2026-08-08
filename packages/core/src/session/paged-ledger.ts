export * as SessionPagedLedger from "./paged-ledger"

import { createHash } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import { Effect, Schema } from "effect"
import type { Database } from "../database/database"
import { EventV2 } from "../event"
import { EventTable } from "../event/sql"
import type { SessionMessage } from "./message"
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

export class PageOutRefused extends Schema.TaggedErrorClass<PageOutRefused>()(
  "SessionPagedLedger.PageOutRefused",
  {
    id: EventV2.ID,
    dirtyState: Schema.String,
  },
) {
  override get message() {
    return `Cannot page out ${this.id} while its dirty state is ${this.dirtyState}`
  }
}

export class PageRestoreRefused extends Schema.TaggedErrorClass<PageRestoreRefused>()(
  "SessionPagedLedger.PageRestoreRefused",
  {
    id: EventV2.ID,
    firstMessageSeq: Schema.Int,
    lastMessageSeq: Schema.Int,
    reason: Schema.String,
  },
) {
  override get message() {
    return `Cannot restore page ${this.id}: ${this.reason}`
  }
}

type Observation = {
  readonly sessionID: SessionSchema.ID
  readonly baselineSeq: number
  readonly messageSeqs: ReadonlyArray<number>
  readonly context: string
  readonly estimatedTokens: number
  readonly contextLimit: number
  readonly dirtyState: DirtyState
}

export const contentHash = (context: string) => createHash("sha256").update(context).digest("hex")

/** Classify only durable session evidence; semantic authorship remains unclassified. */
export const classify = (messages: ReadonlyArray<SessionMessage.Message>): DirtyState =>
  messages.some(
    (message) =>
      message.type === "assistant" &&
      message.content.some(
        (part) => part.type === "tool" && (part.state.status === "pending" || part.state.status === "running"),
      ),
  )
    ? "tool_result_pending"
    : "unclassified"

const latestCompactionEvent = Effect.fn("SessionPagedLedger.latestCompactionEvent")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  type: "session.next.compaction.started" | "session.next.compaction.ended",
) {
  return yield* db
    .select({ seq: EventTable.seq })
    .from(EventTable)
    .where(and(eq(EventTable.aggregate_id, sessionID), eq(EventTable.type, type)))
    .orderBy(desc(EventTable.seq))
    .limit(1)
    .get()
    .pipe(Effect.orDie)
})

/** Add only durable compaction evidence to the pure message classification. */
export const classifyDurable = Effect.fn("SessionPagedLedger.classifyDurable")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  messages: ReadonlyArray<SessionMessage.Message>,
) {
  const classified = classify(messages)
  if (classified !== "unclassified") return classified
  const [started, ended] = yield* Effect.all([
    latestCompactionEvent(db, sessionID, "session.next.compaction.started"),
    latestCompactionEvent(db, sessionID, "session.next.compaction.ended"),
  ])
  if (started !== undefined && (ended === undefined || started.seq > ended.seq)) return "summary_pending"
  return classified
})

export const assertRestoredRange = Effect.fn("SessionPagedLedger.assertRestoredRange")(function* (
  id: EventV2.ID,
  firstMessageSeq: number,
  lastMessageSeq: number,
  messageSeqs: ReadonlyArray<number> | undefined,
  entries: ReadonlyArray<{ readonly seq: number }>,
) {
  const actualMessageSeqs = entries.map((entry) => entry.seq)
  const exactSequence =
    messageSeqs === undefined ||
    (actualMessageSeqs.length === messageSeqs.length &&
      actualMessageSeqs.every((seq, index) => seq === messageSeqs[index]))
  if (!exactSequence || entries[0]?.seq !== firstMessageSeq || entries.at(-1)?.seq !== lastMessageSeq)
    return yield* new PageRestoreRefused({
      id,
      firstMessageSeq,
      lastMessageSeq,
      reason:
        entries.length === 0
          ? "source_range_missing"
          : messageSeqs === undefined
            ? "source_range_incomplete"
            : "source_sequence_mismatch",
    })
})

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
      message_seqs: messageSeqs,
      content_hash: contentHash(observation.context),
      estimated_tokens: observation.estimatedTokens,
      context_limit: observation.contextLimit,
      dirty_state: observation.dirtyState,
    })
    .returning({ id: SessionPagedLedgerTable.id })
    .get()
    .pipe(Effect.orDie)
  return row.id
})

/** Mark a candidate checkpointed only after its durable preservation succeeds. */
export const checkpoint = Effect.fn("SessionPagedLedger.checkpoint")(function* (
  db: DatabaseService,
  id: EventV2.ID,
) {
  yield* db
    .update(SessionPagedLedgerTable)
    .set({ dirty_state: "checkpointed" })
    .where(eq(SessionPagedLedgerTable.id, id))
    .run()
    .pipe(Effect.orDie)
})

export const pageOut = Effect.fn("SessionPagedLedger.pageOut")(function* (
  db: DatabaseService,
  id: EventV2.ID,
  reason: string,
) {
  const row = yield* db
    .select({ dirtyState: SessionPagedLedgerTable.dirty_state })
    .from(SessionPagedLedgerTable)
    .where(eq(SessionPagedLedgerTable.id, id))
    .get()
    .pipe(Effect.orDie)
  if (row && row.dirtyState !== "checkpointed")
    return yield* new PageOutRefused({ id, dirtyState: row.dirtyState })
  yield* db
    .update(SessionPagedLedgerTable)
    .set({ residency: "paged_out", page_out_reason: reason })
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
