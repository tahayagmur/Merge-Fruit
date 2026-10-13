"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isEmailAllowed, safeRedirectPath } from "@/lib/auth/access";
import { getServerEnvStatus } from "@/lib/env";
import { logger } from "@/lib/logger";
import { clientAddress, signInLimiterByAddress, signInLimiterByEmail } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validation/auth";

export interface SignInState {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  email?: string;
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")) : "";

  if (!parsed.success) {
    const fieldErrors: SignInState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "email" || key === "password") && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, email };
  }

  const config = getServerEnvStatus();
  if (!config.ok) {
    return { error: "AI HQ is not configured yet. Complete the environment setup first.", email };
  }

  const address = clientAddress(await headers());
  const byAddress = signInLimiterByAddress.peek(address);
  const byEmail = signInLimiterByEmail.peek(parsed.data.email);
  if (!byAddress.allowed || !byEmail.allowed) {
    logger.warn("auth.sign_in_rate_limited", { address, limitedBy: byAddress.allowed ? "email" : "address" });
    const wait = Math.max(byAddress.retryAfterSeconds, byEmail.retryAfterSeconds);
    return { error: `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`, email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    signInLimiterByAddress.check(address);
    signInLimiterByEmail.check(parsed.data.email);
    logger.info("auth.sign_in_failed", { address, reason: error?.code ?? "no_user" });
    if (error?.status === 429) return { error: "Too many attempts. Wait a moment and try again.", email };
    // Same message for unknown email and wrong password: no account enumeration.
    return { error: "Invalid email or password.", email };
  }

  if (!isEmailAllowed(data.user.email, config.env.allowedEmails)) {
    logger.warn("auth.sign_in_not_allowlisted", { address, userId: data.user.id });
    await supabase.auth.signOut();
    return { error: "This account is not allowed to use AI HQ.", email };
  }

  signInLimiterByEmail.reset(parsed.data.email);
  logger.info("auth.sign_in", { userId: data.user.id });
  redirect(safeRedirectPath(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const config = getServerEnvStatus();
  if (config.ok) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
