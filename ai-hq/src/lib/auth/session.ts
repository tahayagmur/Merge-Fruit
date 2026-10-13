import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient, type AppSupabaseClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "./access";
import { mfaState } from "./assurance";

export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthContext =
  | { status: "authenticated"; user: AuthUser; supabase: AppSupabaseClient }
  /** Password accepted, but the account's second factor has not been verified in this session. */
  | { status: "mfa_required"; user: AuthUser; supabase: AppSupabaseClient }
  | { status: "forbidden"; user: AuthUser }
  | { status: "unauthenticated" };

/**
 * Resolves the signed-in user for the current request.
 *
 * Uses supabase.auth.getUser(), which validates the access token with the
 * Supabase Auth server instead of trusting the cookie contents. Two-factor
 * state uses the factors from that server response. Memoised per request in
 * Server Components via React.cache.
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

  // getUser() above validated the current access token, so its aal claim can be read.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!mfaState(data.user.factors, sessionData.session?.access_token).satisfied) {
    return { status: "mfa_required", user, supabase };
  }

  return { status: "authenticated", user, supabase };
});

/** For Server Components: returns the user or redirects to the login page. */
export async function requireUser(): Promise<{ user: AuthUser; supabase: AppSupabaseClient }> {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "forbidden") redirect("/login?error=forbidden");
  if (auth.status === "mfa_required") redirect("/login/mfa");
  return { user: auth.user, supabase: auth.supabase };
}
