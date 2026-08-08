import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260808044152_dirty_state_reason",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session_paged_ledger\` ADD \`dirty_state_reason\` text;`)
    })
  },
} satisfies DatabaseMigration.Migration
