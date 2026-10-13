import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, totp, verifyTotp, wrongTotp } from "../e2e/support/totp";

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (6-digit truncation of the published values).
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("test TOTP helper", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totp(SECRET, 59_000)).toBe("287082");
    expect(totp(SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totp(SECRET, 1_234_567_890_000)).toBe("005924");
    expect(totp(SECRET, 2_000_000_000_000)).toBe("279037");
  });

  it("round-trips base32 and tolerates one step of drift only", () => {
    expect(base32Decode(SECRET).toString()).toBe("12345678901234567890");
    const now = 1_700_000_000_000;
    expect(verifyTotp(SECRET, totp(SECRET, now - 30_000), now)).toBe(true);
    expect(verifyTotp(SECRET, totp(SECRET, now - 90_000), now)).toBe(false);
    expect(verifyTotp(SECRET, wrongTotp(SECRET))).toBe(false);
  });
});
