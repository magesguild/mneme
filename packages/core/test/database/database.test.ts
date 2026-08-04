import { describe, expect, test } from "bun:test"
import { Database } from "@opencode-ai/core/database/database"

describe("database path", () => {
  test("uses the Mneme data namespace by default", () => {
    const value = Database.path()
    expect(value === ":memory:" || value.includes("mneme")).toBe(true)
    expect(value).not.toContain("opencode")
  })
})
