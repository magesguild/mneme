import { describe, expect } from "bun:test"
import { Cause, Effect, Exit } from "effect"
import { SessionContextStyle } from "@opencode-ai/core/session/context-style"
import { it } from "./lib/effect"

describe("SessionContextStyle", () => {
  it.effect("selects a style when the first prompt has no selection", () =>
    Effect.gen(function* () {
      expect(yield* SessionContextStyle.select(undefined, "standard")).toBe("standard")
      expect(yield* SessionContextStyle.select(undefined, "paged")).toBe("paged")
    }),
  )

  it.effect("makes repeating the selected style idempotent", () =>
    Effect.gen(function* () {
      expect(yield* SessionContextStyle.select("paged", "paged")).toBe("paged")
    }),
  )

  it.effect("rejects changing the style after the first prompt", () =>
    Effect.gen(function* () {
      const exit = yield* SessionContextStyle.select("standard", "paged").pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(Cause.squash(exit.cause)).toEqual(
          new SessionContextStyle.LockedConflict({ current: "standard", requested: "paged" }),
        )
      }
    }),
  )
})
