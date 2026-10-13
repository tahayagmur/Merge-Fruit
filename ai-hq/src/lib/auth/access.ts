/**
 * Pure access rules shared by proxy.ts, Server Actions and Route Handlers.
 */

/** An empty allowlist admits every authenticated user (only permitted outside production). */
export function isEmailAllowed(email: string | null | undefined, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return true;
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}

/**
 * Returns `next` only when it is a same-origin path, preventing open redirects
 * such as `//evil.example` or `https://evil.example` after sign-in.
 */
export function safeRedirectPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (next.startsWith("/login") || next.startsWith("/api/")) return fallback;
  return next;
}
