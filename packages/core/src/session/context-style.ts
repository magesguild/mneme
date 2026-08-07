export * as SessionContextStyle from "./context-style"

import { Effect, Schema } from "effect"
import { eq } from "drizzle-orm"
import type { Database } from "../database/database"
import { SessionContextStyleTable } from "./sql"
import type { SessionSchema } from "./schema"

/** The context assembly strategy selected for a session's first prompt. */
export const Style = Schema.Literals(["standard", "paged"])
export type Style = typeof Style.Type

type DatabaseService = Database.Interface["db"]

/** A session cannot change context assembly strategy after it has been selected. */
export class LockedConflict extends Schema.TaggedErrorClass<LockedConflict>()("SessionContextStyle.LockedConflict", {
  current: Style,
  requested: Style,
}) {
  override get message() {
    return `Context style is locked to ${this.current}; cannot change it to ${this.requested}`
  }
}

/**
 * Select a context style at the first prompt and preserve it thereafter.
 *
 * Repeating the same selection is idempotent. A different selection is a
 * conflict and must be handled as a new-session or explicit migration decision,
 * never as an in-place toggle.
 */
export function select(
  current: Style | undefined,
  requested: Style,
): Effect.Effect<Style, LockedConflict> {
  if (current === undefined || current === requested) return Effect.succeed(requested)
  return Effect.fail(new LockedConflict({ current, requested }))
}

/** Read the style selected for a session, if its first prompt has not arrived. */
export const current = Effect.fn("SessionContextStyle.current")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
) {
  const row = yield* db
    .select({ style: SessionContextStyleTable.style })
    .from(SessionContextStyleTable)
    .where(eq(SessionContextStyleTable.session_id, sessionID))
    .get()
    .pipe(Effect.orDie)
  return row?.style
})

/** Select and durably lock a session style at first-prompt admission. */
export const lock = Effect.fn("SessionContextStyle.lock")(function* (
  db: DatabaseService,
  sessionID: SessionSchema.ID,
  requested?: Style,
) {
  const existing = yield* current(db, sessionID)
  if (existing !== undefined) return yield* select(existing, requested ?? existing)

  const chosen = yield* select(undefined, requested ?? "standard")
  const inserted = yield* db
    .insert(SessionContextStyleTable)
    .values({ session_id: sessionID, style: chosen })
    .onConflictDoNothing()
    .returning({ style: SessionContextStyleTable.style })
    .get()
    .pipe(Effect.orDie)
  if (inserted) return inserted.style

  const raced = yield* current(db, sessionID)
  if (raced === undefined) return yield* Effect.die("Context style selection was not durable")
  return yield* select(raced, requested ?? raced)
})
