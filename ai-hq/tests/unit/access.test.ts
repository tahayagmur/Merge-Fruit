import { describe, expect, it } from "vitest";
import { isEmailAllowed, safeRedirectPath } from "@/lib/auth/access";

describe("isEmailAllowed", () => {
  it("admits everyone when the allowlist is empty", () => {
    expect(isEmailAllowed("anyone@example.com", [])).toBe(true);
  });

  it("matches case-insensitively against the allowlist", () => {
    expect(isEmailAllowed("Owner@Example.com", ["owner@example.com"])).toBe(true);
    expect(isEmailAllowed("intruder@example.com", ["owner@example.com"])).toBe(false);
  });

  it("rejects users without an email when an allowlist is set", () => {
    expect(isEmailAllowed(null, ["owner@example.com"])).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirectPath("/projects/123?tab=tasks")).toBe("/projects/123?tab=tasks");
  });

  it.each(["//evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)", "/login", "/api/projects", 42, undefined])(
    "falls back for %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/");
    },
  );
});
