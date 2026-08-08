import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260808053059_paged_ledger_sequence_index",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(
        `CREATE UNIQUE INDEX \`session_paged_ledger_session_seq_idx\` ON \`session_paged_ledger\` (\`session_id\`,\`ledger_seq\`);`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
