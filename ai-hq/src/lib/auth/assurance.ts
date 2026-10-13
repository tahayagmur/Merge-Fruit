/**
 * Two-factor (MFA) assurance for a request.
 *
 * `factors` must come from Supabase Auth's server response (getUser), never
 * from the session cookie: a user could strip factors from their own cookie to
 * skip the second step. The access token's `aal` claim is trustworthy once the
 * same token has been validated by getUser.
 */
export interface AuthFactor {
  factor_type: string;
  status: string;
}

export interface MfaState {
  /** The account has at least one verified second factor. */
  required: boolean;
  /** The current session completed the second factor (aal2). */
  satisfied: boolean;
}

export function accessTokenAal(accessToken: string | null | undefined): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { aal?: unknown };
    return typeof claims.aal === "string" ? claims.aal : null;
  } catch {
    return null;
  }
}

export function mfaState(factors: AuthFactor[] | null | undefined, accessToken: string | null | undefined): MfaState {
  const required = (factors ?? []).some((factor) => factor.status === "verified");
  return { required, satisfied: !required || accessTokenAal(accessToken) === "aal2" };
}

export function hasVerifiedTotp(factors: AuthFactor[] | null | undefined): boolean {
  return (factors ?? []).some((factor) => factor.factor_type === "totp" && factor.status === "verified");
}
