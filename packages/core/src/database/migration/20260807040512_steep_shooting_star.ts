import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260807040512_steep_shooting_star",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`session_context_style\` (
          \`session_id\` text PRIMARY KEY,
          \`style\` text NOT NULL,
          \`selected_at\` integer NOT NULL,
          CONSTRAINT \`fk_session_context_style_session_id_session_id_fk\` FOREIGN KEY (\`session_id\`) REFERENCES \`session\`(\`id\`) ON DELETE CASCADE
        );
      `)
    })
  },
} satisfies DatabaseMigration.Migration
