import { EMULATOR_URL, TEST_PUBLISHABLE_KEY } from "./fixtures";

/**
 * Which backend the end-to-end suite runs against:
 * - "emulator" (default): the in-repo test double, no Docker needed.
 * - "supabase": a real LOCAL Supabase stack (`npm run db:start`). Use
 *   `npm run test:e2e:supabase`, which reads the URL and keys from the CLI.
 */
export type E2ETarget = "emulator" | "supabase";

export interface E2EBackend {
  target: E2ETarget;
  supabaseUrl: string;
  publishableKey: string;
  secretKey?: string;
}

const LOCAL = new Set(["127.0.0.1", "localhost"]);

export function e2eBackend(env: Record<string, string | undefined> = process.env): E2EBackend {
  if (env.E2E_TARGET !== "supabase") {
    return { target: "emulator", supabaseUrl: EMULATOR_URL, publishableKey: TEST_PUBLISHABLE_KEY };
  }
  const supabaseUrl = env.E2E_SUPABASE_URL ?? "";
  const publishableKey = env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "";
  const secretKey = env.E2E_SUPABASE_SECRET_KEY ?? "";
  if (!supabaseUrl || !publishableKey || !secretKey) {
    throw new Error("E2E_TARGET=supabase needs E2E_SUPABASE_URL, E2E_SUPABASE_PUBLISHABLE_KEY and E2E_SUPABASE_SECRET_KEY.");
  }
  // Test users are created with the admin API: never point this at a hosted project.
  if (!LOCAL.has(new URL(supabaseUrl).hostname)) {
    throw new Error("E2E_TARGET=supabase only runs against a local Supabase (127.0.0.1 / localhost).");
  }
  return { target: "supabase", supabaseUrl, publishableKey, secretKey };
}
