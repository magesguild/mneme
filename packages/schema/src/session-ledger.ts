export * as SessionLedger from "./session-ledger"

import { Schema } from "effect"
import { Event } from "./event"
import { DateTimeUtcFromMillis, NonNegativeInt, optional } from "./schema"

export const Residency = Schema.Literals(["resident", "paged_out"])
export type Residency = typeof Residency.Type

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

export const DirtyStateReason = Schema.Literals([
  "no_authoritative_dirty_state",
  "unsettled_tool_state",
  "unsettled_compaction",
  "compaction-completed",
])
export type DirtyStateReason = typeof DirtyStateReason.Type

export const PageOutReason = Schema.Literals(["compaction"])
export type PageOutReason = typeof PageOutReason.Type

export const PageInReason = Schema.Literals(["restored-exact-range"])
export type PageInReason = typeof PageInReason.Type

export const SourceCompleteness = Schema.Literals(["exact", "legacy_limited"])
export type SourceCompleteness = typeof SourceCompleteness.Type

export interface MessageRange extends Schema.Schema.Type<typeof MessageRange> {}
export const MessageRange = Schema.Struct({
  first: NonNegativeInt,
  last: NonNegativeInt,
}).annotate({ identifier: "SessionLedger.MessageRange" })

export interface Entry extends Schema.Schema.Type<typeof Entry> {}
export const Entry = Schema.Struct({
  id: Event.ID,
  sequence: NonNegativeInt,
  baselineSequence: NonNegativeInt,
  messageRange: MessageRange.pipe(optional),
  sourceCompleteness: SourceCompleteness,
  estimatedTokens: NonNegativeInt,
  contextLimit: NonNegativeInt,
  residency: Residency,
  dirtyState: DirtyState,
  dirtyStateReason: DirtyStateReason.pipe(optional),
  pageOutReason: PageOutReason.pipe(optional),
  pageInReason: PageInReason.pipe(optional),
  createdAt: DateTimeUtcFromMillis,
}).annotate({ identifier: "SessionLedger.Entry" })

export interface Page extends Schema.Schema.Type<typeof Page> {}
export const Page = Schema.Struct({
  data: Schema.Array(Entry),
  hasMore: Schema.Boolean,
  cursor: Schema.Struct({
    previous: Schema.String.pipe(optional),
    next: Schema.String.pipe(optional),
  }),
}).annotate({ identifier: "SessionLedger.Page" })
