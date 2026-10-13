import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient, type AppSupabaseClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "./access";

export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthContext =
  | { status: "authenticated"; user: AuthUser; supabase: AppSupabaseClient }
  | { status: "forbidden"; user: AuthUser }
  | { status: "unauthenticated" };

/**
 * Resolves the signed-in user for the current request.
 *
 * Uses supabase.auth.getUser(), which validates the access token with the
 * Supabase Auth server instead of trusting the cookie contents. Memoised per
 * request in Server Components via React.cache.
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createSupabaseServerClient();
  const env = getServerEnv();

  let data: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"];
  try {
    const result = await supabase.auth.getUser();
    if (result.error) return { status: "unauthenticated" };
    data = result.data;
  } catch {
    return { status: "unauthenticated" };
  }
  if (!data.user) return { status: "unauthenticated" };

  const user: AuthUser = { id: data.user.id, email: data.user.email ?? null };
  if (!isEmailAllowed(user.email, env.allowedEmails)) return { status: "forbidden", user };

  return { status: "authenticated", user, supabase };
});

/** For Server Components: returns the user or redirects to the login page. */
export async function requireUser(): Promise<{ user: AuthUser; supabase: AppSupabaseClient }> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "forbidden") redirect("/login?error=forbidden");
  return { user: auth.user, supabase: auth.supabase };
}
