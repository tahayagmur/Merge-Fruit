import { describe, expect, it } from "vitest";
import { accessTokenAal, hasVerifiedTotp, mfaState } from "@/lib/auth/assurance";

const token = (claims: object) =>
  `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

describe("MFA assurance", () => {
  it("reads the aal claim and tolerates malformed tokens", () => {
    expect(accessTokenAal(token({ aal: "aal2" }))).toBe("aal2");
    expect(accessTokenAal(token({}))).toBeNull();
    expect(accessTokenAal("not-a-jwt")).toBeNull();
    expect(accessTokenAal("a.%%%.c")).toBeNull();
    expect(accessTokenAal(undefined)).toBeNull();
  });

  it("requires aal2 only when a verified factor exists", () => {
    const verified = [{ factor_type: "totp", status: "verified" }];
    expect(mfaState([], token({ aal: "aal1" }))).toEqual({ required: false, satisfied: true });
    expect(mfaState([{ factor_type: "totp", status: "unverified" }], token({ aal: "aal1" }))).toEqual({
      required: false,
      satisfied: true,
    });
    expect(mfaState(verified, token({ aal: "aal1" }))).toEqual({ required: true, satisfied: false });
    expect(mfaState(verified, token({ aal: "aal2" }))).toEqual({ required: true, satisfied: true });
    expect(mfaState(verified, undefined)).toEqual({ required: true, satisfied: false });
  });

  it("detects a verified authenticator app", () => {
    expect(hasVerifiedTotp([{ factor_type: "totp", status: "verified" }])).toBe(true);
    expect(hasVerifiedTotp([{ factor_type: "phone", status: "verified" }])).toBe(false);
    expect(hasVerifiedTotp(null)).toBe(false);
  });
});
