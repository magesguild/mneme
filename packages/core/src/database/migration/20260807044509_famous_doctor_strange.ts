import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260807044509_famous_doctor_strange",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session_paged_ledger\` ADD \`page_out_reason\` text;`)
      yield* tx.run(`ALTER TABLE \`session_paged_ledger\` ADD \`page_in_reason\` text;`)
    })
  },
} satisfies DatabaseMigration.Migration
