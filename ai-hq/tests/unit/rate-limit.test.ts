import { describe, expect, it } from "vitest";
import { clientAddress, createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1_000 });
    const now = 10_000;
    expect([1, 2, 3].map(() => limiter.check("k", now).allowed)).toEqual([true, true, true]);
    const blocked = limiter.check("k", now + 100);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
    expect(limiter.peek("k", now + 100).allowed).toBe(false);
  });

  it("peek does not consume attempts", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(limiter.peek("k", 0).allowed).toBe(true);
    expect(limiter.peek("k", 0).allowed).toBe(true);
    limiter.check("k", 0);
    expect(limiter.peek("k", 0).allowed).toBe(false);
  });

  it("opens a new window after expiry and supports reset", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    limiter.check("k", 0);
    expect(limiter.check("k", 500).allowed).toBe(false);
    expect(limiter.check("k", 1_001).allowed).toBe(true);
    limiter.check("k", 1_002);
    limiter.reset("k");
    expect(limiter.peek("k", 1_003).allowed).toBe(true);
  });

  it("keeps keys separate and bounds memory", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 0);
    // "a" was evicted as the oldest key, so it starts fresh.
    expect(limiter.peek("a", 1).allowed).toBe(true);
    expect(limiter.peek("c", 1).allowed).toBe(false);
  });
});

describe("clientAddress", () => {
  it("prefers x-real-ip, then the hop added by the proxy", () => {
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4" }))).toBe("198.51.100.7");
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(clientAddress(new Headers())).toBe("unknown");
  });

  it("ignores forwarded hops a client can forge", () => {
    // A client sends "X-Forwarded-For: 10.9.9.9"; the proxy appends the real address.
    expect(clientAddress(new Headers({ "x-forwarded-for": "10.9.9.9, 203.0.113.5" }))).toBe("203.0.113.5");
    expect(clientAddress(new Headers({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
