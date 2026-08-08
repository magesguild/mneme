import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { SessionHistoryQuery, SessionLedgerCursor, SessionsCursor } from "../src/groups/session"
import { Session } from "@opencode-ai/schema/session"

describe("SessionsCursor", () => {
  test("round trips without Node globals", async () => {
    const input = {
      workspace: undefined,
      search: "protocol",
      order: "desc" as const,
      anchor: { id: Session.ID.make("ses_test"), time: 1, direction: "next" as const },
    }
    const cursor = SessionsCursor.make(input)

    expect(await Effect.runPromise(SessionsCursor.parse(cursor))).toEqual(input)
  })
})

describe("SessionHistoryQuery", () => {
  test("decodes numeric paging inputs", async () => {
    const query = await Effect.runPromise(Schema.decodeUnknownEffect(SessionHistoryQuery)({ after: "3", limit: "10" }))

    expect(query).toEqual({ after: 3, limit: 10 })
  })
})

describe("SessionLedgerCursor", () => {
  test("round trips the fixed ledger query and direction", async () => {
    const input = {
      version: 1 as const,
      sessionID: Session.ID.make("ses_test"),
      limit: 50,
      order: "desc" as const,
      direction: "next" as const,
      sequence: 12,
    }
    const cursor = SessionLedgerCursor.make(input)

    expect(await Effect.runPromise(SessionLedgerCursor.parse(cursor))).toEqual(input)
  })
})
