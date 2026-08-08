export * as SessionContextAssembly from "./context-assembly"

import { Effect } from "effect"
import type { Database } from "../database/database"
import type { EventV2 } from "../event"
import { SessionContextStyle } from "./context-style"
import { SessionPagedLedger } from "./paged-ledger"
import type { SessionSchema } from "./schema"

type DatabaseService = Database.Interface["db"]

export type Input = {
  readonly sessionID: SessionSchema.ID
  readonly style: SessionContextStyle.Style
  readonly baselineSeq: number
  readonly messageSeqs: ReadonlyArray<number>
  readonly context: string
  readonly estimatedTokens: number
  readonly contextLimit: number
  readonly dirtyState: SessionPagedLedger.Classification
}

export type Restoration = {
  readonly pageID: EventV2.ID
  readonly firstMessageSeq: number
  readonly lastMessageSeq: number
  readonly messageSeqs: ReadonlyArray<number> | undefined
}

/**
 * Prepare the selected context style without changing the legacy request.
 *
 * Standard sessions are intentionally a no-op. Paged sessions currently record
 * a shadow observation; page residency and restoration will be added behind
 * this seam without replacing OpenCode history or compaction.
 */
export const prepare = Effect.fn("SessionContextAssembly.prepare")(function* (
  db: DatabaseService,
  input: Input,
) {
  if (input.style === "standard") return undefined
  return yield* SessionPagedLedger.observe(db, input)
})

/** Restore one exact prior page when it fits without replacing the current path. */
export const restore = Effect.fn("SessionContextAssembly.restore")(function* (
  db: DatabaseService,
  input: {
    readonly sessionID: SessionSchema.ID
    readonly style: SessionContextStyle.Style
    readonly baseTokens: number
    readonly contextLimit: number
  },
) {
  if (input.style === "standard" || input.contextLimit <= 0) return undefined
  const page = yield* SessionPagedLedger.latestPagedOut(db, input.sessionID)
  if (
    page === undefined ||
    page.first_message_seq === null ||
    page.last_message_seq === null ||
    input.baseTokens + page.estimated_tokens > input.contextLimit
  )
    return undefined
  return {
    pageID: page.id,
    firstMessageSeq: page.first_message_seq,
    lastMessageSeq: page.last_message_seq,
    messageSeqs: page.message_seqs ?? undefined,
  }
})
