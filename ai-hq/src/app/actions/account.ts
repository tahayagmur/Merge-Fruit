"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { clientAddress, createRateLimiter } from "@/lib/rate-limit";
import { passwordChangeSchema } from "@/lib/validation/settings";

export interface PasswordChangeState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;
}

// Failed re-authentication attempts per user.
const passwordChangeLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

/**
 * Changes the password after re-verifying the current one. Other sessions are
 * signed out; this session stays signed in.
 */
export async function changePassword(_previous: PasswordChangeState, formData: FormData): Promise<PasswordChangeState> {
  const { user, supabase } = await requireUser();

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: PasswordChangeState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "currentPassword" || key === "newPassword" || key === "confirmPassword") && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { fieldErrors };
  }

  if (!passwordChangeLimiter.peek(user.id).allowed || !user.email) {
    return { error: "Too many attempts. Try again later." };
  }

  // Re-authenticate: a stolen session alone must not be enough to change the password.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    passwordChangeLimiter.check(user.id);
    logger.warn("account.password_change_rejected", { userId: user.id, address: clientAddress(await headers()) });
    return { fieldErrors: { currentPassword: "The current password is not correct." } };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    logger.warn("account.password_change_failed", { userId: user.id, code: error.code });
    return { error: error.code === "weak_password" ? "Choose a stronger password." : "The password could not be changed." };
  }

  await supabase.auth.signOut({ scope: "others" });
  passwordChangeLimiter.reset(user.id);
  logger.info("account.password_changed", { userId: user.id });
  return { ok: true };
}

/** Revokes every session of the user (all devices), then returns to the login page. */
export async function signOutEverywhere(): Promise<void> {
  const { user, supabase } = await requireUser();
  await supabase.auth.signOut({ scope: "global" });
  logger.info("account.signed_out_everywhere", { userId: user.id });
  redirect("/login");
}
