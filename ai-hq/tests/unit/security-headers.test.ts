import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

function directives(policy: string) {
  return Object.fromEntries(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

describe("content security policy", () => {
  it("only allows this origin and blocks framing, plugins, base and form hijacking", () => {
    const csp = directives(contentSecurityPolicy({ dev: false }));
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["connect-src"]).toEqual(["'self'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["frame-src"]).toEqual(["'none'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    // No third-party hosts anywhere.
    expect(contentSecurityPolicy({ dev: false })).not.toMatch(/https?:|\*/);
  });

  it("never allows eval in production; development adds only eval and the HMR socket", () => {
    expect(directives(contentSecurityPolicy({ dev: false }))["script-src"]).not.toContain("'unsafe-eval'");
    const dev = directives(contentSecurityPolicy({ dev: true }));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    expect(dev["connect-src"]).toEqual(["'self'", "ws:", "wss:"]);
  });

  it("ships the CSP with the other security headers", () => {
    const keys = securityHeaders({ dev: false }).map((header) => header.key);
    expect(keys).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ]);
  });
});
