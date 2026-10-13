/**
 * Boots the test-only Supabase emulator with the real migrations applied.
 * Started by playwright.config.ts; can also be run by hand:
 *   npx tsx tests/e2e/support/start-emulator.ts
 */
import { PGlite } from "@electric-sql/pglite";
import { schemaSql } from "../../db/harness";
import { EMULATOR_PORT, TEST_PUBLISHABLE_KEY, TEST_SECRET_KEY, USERS } from "./fixtures";
import { startSupabaseEmulator } from "./supabase-emulator";

async function main() {
  const db = new PGlite();
  for (const sql of schemaSql()) await db.exec(sql);

  const emulator = await startSupabaseEmulator({
    db,
    port: EMULATOR_PORT,
    publishableKey: TEST_PUBLISHABLE_KEY,
    secretKey: TEST_SECRET_KEY,
    users: Object.values(USERS),
  });
  console.log(`[supabase-emulator] listening on ${emulator.url}`);

  const shutdown = async () => {
    await emulator.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
