import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260808043645_paged_message_sequences",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session_paged_ledger\` ADD \`message_seqs\` text;`)
    })
  },
} satisfies DatabaseMigration.Migration
