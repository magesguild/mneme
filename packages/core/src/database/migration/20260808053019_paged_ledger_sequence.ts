import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260808053019_paged_ledger_sequence",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session_paged_ledger\` ADD \`ledger_seq\` integer;`)
      yield* tx.run(`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY time_created, id) - 1 AS ledger_seq
          FROM session_paged_ledger
        )
        UPDATE session_paged_ledger
        SET ledger_seq = (SELECT ranked.ledger_seq FROM ranked WHERE ranked.id = session_paged_ledger.id);
      `)
    })
  },
} satisfies DatabaseMigration.Migration
