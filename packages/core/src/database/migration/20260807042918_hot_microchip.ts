import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260807042918_hot_microchip",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`session_paged_ledger\` (
          \`id\` text PRIMARY KEY,
          \`session_id\` text NOT NULL,
          \`baseline_seq\` integer NOT NULL,
          \`first_message_seq\` integer,
          \`last_message_seq\` integer,
          \`content_hash\` text NOT NULL,
          \`estimated_tokens\` integer NOT NULL,
          \`context_limit\` integer NOT NULL,
          \`residency\` text DEFAULT 'resident' NOT NULL,
          \`dirty_state\` text DEFAULT 'unclassified' NOT NULL,
          \`time_created\` integer NOT NULL,
          CONSTRAINT \`fk_session_paged_ledger_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(
        `CREATE INDEX \`session_paged_ledger_session_time_idx\` ON \`session_paged_ledger\` (\`session_id\`,\`time_created\`);`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
