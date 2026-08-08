export * as SessionPagedLedger from "./paged-ledger"

import { createHash } from "node:crypto"
import { and, asc, desc, eq, gt, lt, max } from "drizzle-orm"
import { Effect, Schema } from "effect"
import type { Database } from "../database/database"
import { EventV2 } from "../event"
import { EventTable } from "../event/sql"
import type { SessionMessage } from "./message"
import { SessionPagedLedgerTable } from "./sql"
import type { SessionSchema } from "./schema"

type DatabaseService = Database.Interface["db"]

export type Info = typeof SessionPagedLedgerTable.$inferSelect

export type PageInput = {
  readonly sessionID: SessionSchema.ID
  readonly after?: number
  readonly limit?: number
  readonly order?: "asc" | "desc"
  readonly direction?: "next" | "previous"
}

export type Page = {
  readonly data: ReadonlyArray<Info>
  readonly hasMore: boolean
  readonly firstSequence: number | undefined
  readonly lastSequence: number | undefined
}

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
    residency: Schema.String,
  },
) {
  override get message() {
    return `Cannot page out ${this.id} while its dirty state is ${this.dirtyState} and residency is ${this.residency}`
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

export class PageInRefused extends Schema.TaggedErrorClass<PageInRefused>()(
  "SessionPagedLedger.PageInRefused",
  {
    id: EventV2.ID,
    residency: Schema.String,
  },
) {
  override get message() {
    return `Cannot page in ${this.id} while its residency is ${this.residency}`
  }
}

export class CheckpointRefused extends Schema.TaggedErrorClass<CheckpointRefused>()(
  "SessionPagedLedger.CheckpointRefused",
  {
    id: EventV2.ID,
    residency: Schema.String,
  },
) {
  override get message() {
    return `Cannot checkpoint ${this.id} while its residency is ${this.residency}`
  }
}

type Observation = {
  readonly sessionID: SessionSchema.ID
  readonly baselineSeq: number
  readonly messageSeqs: ReadonlyArray<number>
  readonly context: string
  readonly estimatedTokens: number
  readonly contextLimit: number
  readonly dirtyState: Classification
}

export type Classification = {
  readonly state: DirtyState
  readonly reason: string
}

export const contentHash = (context: string) => createHash("sha256").update(context).digest("hex")

/** Classify only durable session evidence; semantic authorship remains unclassified. */
export const classify = (messages: ReadonlyArray<SessionMessage.Message>): Classification =>
  messages.some(
    (message) =>
      message.type === "assistant" &&
      message.content.some(
        (part) => part.type === "tool" && (part.state.status === "pending" || part.state.status === "running"),
      ),
  )
    ? { state: "tool_result_pending", reason: "unsettled_tool_state" }
    : { state: "unclassified", reason: "no_authoritative_dirty_state" }

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
  if (classified.state !== "unclassified") return classified
  const [started, ended] = yield* Effect.all([
    latestCompactionEvent(db, sessionID, "session.next.compaction.started"),
    latestCompactionEvent(db, sessionID, "session.next.compaction.ended"),
  ])
  if (started !== undefined && (ended === undefined || started.seq > ended.seq))
    return { state: "summary_pending" as const, reason: "unsettled_compaction" }
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
  const latest = yield* db
    .select({ ledgerSeq: max(SessionPagedLedgerTable.ledger_seq) })
    .from(SessionPagedLedgerTable)
    .where(eq(SessionPagedLedgerTable.session_id, observation.sessionID))
    .get()
    .pipe(Effect.orDie)
  const ledgerSeq = (latest?.ledgerSeq ?? -1) + 1
  const row = yield* db
    .insert(SessionPagedLedgerTable)
    .values({
      id: EventV2.ID.create(),
      session_id: observation.sessionID,
      baseline_seq: observation.baselineSeq,
      ledger_seq: ledgerSeq,
      first_message_seq: messageSeqs[0],
      last_message_seq: messageSeqs.at(-1),
      message_seqs: messageSeqs,
      content_hash: contentHash(observation.context),
      estimated_tokens: observation.estimatedTokens,
      context_limit: observation.contextLimit,
      dirty_state: observation.dirtyState.state,
      dirty_state_reason: observation.dirtyState.reason,
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
  reason: string,
) {
  const row = yield* db
    .select({ residency: SessionPagedLedgerTable.residency })
    .from(SessionPagedLedgerTable)
    .where(eq(SessionPagedLedgerTable.id, id))
    .get()
    .pipe(Effect.orDie)
  if (row && row.residency !== "resident") return yield* new CheckpointRefused({ id, residency: row.residency })
  yield* db
    .update(SessionPagedLedgerTable)
    .set({ dirty_state: "checkpointed", dirty_state_reason: reason })
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
    .select({ dirtyState: SessionPagedLedgerTable.dirty_state, residency: SessionPagedLedgerTable.residency })
    .from(SessionPagedLedgerTable)
    .where(eq(SessionPagedLedgerTable.id, id))
    .get()
    .pipe(Effect.orDie)
  if (row && (row.dirtyState !== "checkpointed" || row.residency !== "resident"))
    return yield* new PageOutRefused({ id, dirtyState: row.dirtyState, residency: row.residency })
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
  const row = yield* db
    .select({ residency: SessionPagedLedgerTable.residency })
    .from(SessionPagedLedgerTable)
    .where(eq(SessionPagedLedgerTable.id, id))
    .get()
    .pipe(Effect.orDie)
  if (row && row.residency !== "paged_out") return yield* new PageInRefused({ id, residency: row.residency })
  yield* db
    .update(SessionPagedLedgerTable)
    .set({ residency: "resident", page_in_reason: reason })
    .where(eq(SessionPagedLedgerTable.id, id))
    .run()
    .pipe(Effect.orDie)
})

/** Read the complete page ledger for inspection without changing residency. */
export const history = Effect.fn("SessionPagedLedger.history")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  return yield* db
    .select()
    .from(SessionPagedLedgerTable)
    .where(eq(SessionPagedLedgerTable.session_id, sessionID))
    .orderBy(asc(SessionPagedLedgerTable.time_created))
    .all()
    .pipe(Effect.orDie)
})

/** Read one bounded ledger page without changing residency. */
export const page = Effect.fn("SessionPagedLedger.page")(function* (
  db: DatabaseService,
  input: PageInput,
) {
  const requestedOrder = input.order ?? "desc"
  const direction = input.direction ?? "next"
  const order = direction === "previous" ? (requestedOrder === "asc" ? "desc" : "asc") : requestedOrder
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  const boundary =
    input.after === undefined
      ? undefined
      : order === "asc"
        ? gt(SessionPagedLedgerTable.ledger_seq, input.after)
        : lt(SessionPagedLedgerTable.ledger_seq, input.after)
  const where = boundary
    ? and(eq(SessionPagedLedgerTable.session_id, input.sessionID), boundary)
    : eq(SessionPagedLedgerTable.session_id, input.sessionID)
  const rows = yield* db
    .select()
    .from(SessionPagedLedgerTable)
    .where(where)
    .orderBy(order === "asc" ? asc(SessionPagedLedgerTable.ledger_seq) : desc(SessionPagedLedgerTable.ledger_seq))
    .limit(limit + 1)
    .all()
    .pipe(Effect.orDie)
  const data = (direction === "previous" ? rows.slice(0, limit).toReversed() : rows.slice(0, limit))
  return {
    data,
    hasMore: rows.length > limit,
    firstSequence: data[0]?.ledger_seq ?? undefined,
    lastSequence: data.at(-1)?.ledger_seq ?? undefined,
  }
})

export const latestPagedOut = Effect.fn("SessionPagedLedger.latestPagedOut")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  const rows = yield* history(db, sessionID)
  return rows.toReversed().find((row) => row.residency === "paged_out")
})
