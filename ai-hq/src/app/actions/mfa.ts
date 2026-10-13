"use server";

import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/auth/access";
import { hasVerifiedTotp } from "@/lib/auth/assurance";
import { getAuthContext, requireUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rate-limit";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import { mfaEnrollmentConfirmSchema, totpCodeSchema } from "@/lib/validation/auth";

/**
 * Two-factor sign-in with an authenticator app (TOTP), backed by Supabase Auth
 * MFA. Codes and secrets are never logged. Failed codes are rate limited per
 * user on top of Supabase Auth's own limits.
 */

// Failed codes per user, for every MFA action.
const mfaCodeLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

const INVALID_CODE = "That code is not valid. Check that your phone's clock is correct and try again.";
const TOO_MANY = "Too many invalid codes. Try again in a few minutes.";

export type MfaActionResult = { ok: true } | { ok: false; error: string };

async function verifiedTotpFactorId(supabase: AppSupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  return data.totp.find((factor) => factor.status === "verified")?.id ?? null;
}

/** Verifies a code for a factor. Counts failures; returns an error message or null. */
async function checkCode(supabase: AppSupabaseClient, userId: string, factorId: string, code: string): Promise<string | null> {
  if (!mfaCodeLimiter.peek(userId).allowed) return TOO_MANY;
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (!error) {
    mfaCodeLimiter.reset(userId);
    return null;
  }
  mfaCodeLimiter.check(userId);
  logger.warn("auth.mfa_code_rejected", { userId, status: error.status, code: error.code });
  return error.status === 429 ? TOO_MANY : INVALID_CODE;
}

export interface MfaSignInState {
  error?: string;
}

/** Second sign-in step: upgrades the password session to aal2. */
export async function verifyMfaSignIn(_previous: MfaSignInState, formData: FormData): Promise<MfaSignInState> {
  const next = safeRedirectPath(formData.get("next"));
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "forbidden") redirect("/login?error=forbidden");
  if (auth.status === "authenticated") redirect(next);

  const parsed = totpCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const factorId = await verifiedTotpFactorId(auth.supabase);
  if (!factorId) return { error: "No authenticator app is set up for this account. Contact the administrator." };

  const error = await checkCode(auth.supabase, auth.user.id, factorId, parsed.data);
  if (error) return { error };

  logger.info("auth.mfa_verified", { userId: auth.user.id });
  redirect(next);
}

export interface MfaEnrollment {
  factorId: string;
  /** SVG QR code as a data URL; the browser renders it as an image. */
  qrCode: string;
  /** Base32 key for manual entry. Shown once to the user; never stored by AI HQ. */
  secret: string;
}

/** Starts adding an authenticator app. Leftover unfinished setups are removed first. */
export async function startMfaEnrollment(): Promise<{ ok: true; data: MfaEnrollment } | { ok: false; error: string }> {
  const { user, supabase } = await requireUser();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Two-factor settings could not be loaded." };
  if (hasVerifiedTotp(factors.all)) return { ok: false, error: "Two-factor sign-in is already on." };

  for (const factor of factors.all.filter((item) => item.factor_type === "totp" && item.status !== "verified")) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "AI HQ", issuer: "AI HQ" });
  if (error || data.type !== "totp") {
    logger.warn("account.mfa_enrollment_failed", { userId: user.id, code: error?.code });
    return {
      ok: false,
      error:
        error?.code === "mfa_totp_enroll_not_enabled"
          ? "Authenticator apps are not enabled for this Supabase project."
          : "The setup could not be started. Try again.",
    };
  }

  // Re-encode the SVG so characters such as "#" cannot break the data URL.
  const svg = data.totp.qr_code.replace(/^data:image\/svg\+xml;[^,]*,/, "");
  logger.info("account.mfa_enrollment_started", { userId: user.id });
  return {
    ok: true,
    data: {
      factorId: data.id,
      qrCode: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      secret: data.totp.secret,
    },
  };
}

/** Finishes the setup with a first code from the app; the session becomes aal2. */
export async function confirmMfaEnrollment(input: { factorId: string; code: string }): Promise<MfaActionResult> {
  const { user, supabase } = await requireUser();
  const parsed = mfaEnrollmentConfirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const pending = factors?.all.find(
    (factor) => factor.id === parsed.data.factorId && factor.factor_type === "totp" && factor.status !== "verified",
  );
  if (listError || !pending) return { ok: false, error: "This setup is no longer valid. Start again." };

  const error = await checkCode(supabase, user.id, pending.id, parsed.data.code);
  if (error) return { ok: false, error };

  logger.info("account.mfa_enabled", { userId: user.id });
  return { ok: true };
}

/** Turns two-factor sign-in off after checking a current code. */
export async function disableMfa(input: { code: string }): Promise<MfaActionResult> {
  const { user, supabase } = await requireUser();
  const parsed = totpCodeSchema.safeParse(input?.code);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid code." };

  const factorId = await verifiedTotpFactorId(supabase);
  if (!factorId) return { ok: false, error: "Two-factor sign-in is not on." };

  const error = await checkCode(supabase, user.id, factorId, parsed.data);
  if (error) return { ok: false, error };

  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
  if (unenrollError) {
    logger.warn("account.mfa_disable_failed", { userId: user.id, code: unenrollError.code });
    return { ok: false, error: "Two-factor sign-in could not be turned off. Try again." };
  }
  logger.info("account.mfa_disabled", { userId: user.id });
  return { ok: true };
}
