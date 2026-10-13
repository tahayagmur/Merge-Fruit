import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";
import { getServerEnv } from "@/lib/env";
import { authCookieOptions, withSessionLifetime } from "./cookie-options";

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase client bound to the current request's auth cookies. It uses the
 * publishable key, so every query runs as the signed-in user and is subject to
 * row level security. Create one per request; never share it between requests.
 */
export async function createSupabaseServerClient(): Promise<AppSupabaseClient> {
  // Opt into request-time rendering before touching configuration or auth:
  // nothing session-related is ever prerendered, configuration is only read at
  // runtime, and supabase-js may use the current time while it loads the session.
  await connection();
  const cookieStore = await cookies();
  const env = getServerEnv();

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: authCookieOptions(env),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, withSessionLifetime(options));
          }
        } catch {
          // Server Components cannot write cookies. proxy.ts refreshes the
          // session on every request, so ignoring the write here is safe.
        }
      },
    },
  });
}
