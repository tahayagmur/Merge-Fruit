/**
 * In-memory fixed-window rate limiter.
 *
 * Effective for a single server instance (the planned self-hosted setup). With
 * several instances each one counts separately, so treat it as a best-effort
 * layer on top of Supabase Auth's own limits, not as the only protection.
 */

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Records one attempt and reports whether it is still within the limit. */
  check(key: string, now?: number): RateLimitResult;
  /** Reports the current state without recording an attempt. */
  peek(key: string, now?: number): RateLimitResult;
  reset(key: string): void;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, Window>();

  function prune(now: number) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
    // Still full: drop the oldest entries (Map keeps insertion order) to make room for one more.
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) break;
      windows.delete(oldest);
    }
  }

  function result(window: Window | undefined, now: number, recorded: boolean): RateLimitResult {
    const count = window && window.resetAt > now ? window.count : 0;
    // A peek is blocked once the limit is reached; a recorded attempt once it is exceeded.
    const allowed = recorded ? count <= limit : count < limit;
    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: allowed || !window ? 0 : Math.ceil((window.resetAt - now) / 1000),
    };
  }

  return {
    check(key, now = Date.now()) {
      let window = windows.get(key);
      if (!window || window.resetAt <= now) {
        if (windows.size >= maxKeys) prune(now);
        window = { count: 0, resetAt: now + windowMs };
        windows.set(key, window);
      }
      window.count += 1;
      return result(window, now, true);
    },
    peek(key, now = Date.now()) {
      return result(windows.get(key), now, false);
    },
    reset(key) {
      windows.delete(key);
    },
  };
}

/**
 * Client address as reported by OUR reverse proxy: X-Real-IP (set, not
 * appended, by the proxy), else the LAST X-Forwarded-For hop (the one the
 * proxy added). Earlier hops come from the client and can be forged, so they
 * are ignored. The app port must not be reachable without the proxy.
 */
export function clientAddress(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const hops = headers.get("x-forwarded-for")?.split(",").map((hop) => hop.trim()).filter(Boolean) ?? [];
  return hops.at(-1) ?? "unknown";
}

// Shared limiters for authentication. They count FAILED attempts only.
export const signInLimiterByAddress = createRateLimiter({ limit: 20, windowMs: 15 * 60_000 });
export const signInLimiterByEmail = createRateLimiter({ limit: 8, windowMs: 15 * 60_000 });
