import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, redact, redactString } from "@/lib/logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("redaction", () => {
  it("masks sensitive keys at any depth", () => {
    expect(
      redact({
        user: "alice",
        password: "hunter2",
        nested: { access_token: "abc", apiKey: "k", headers: { Authorization: "Bearer xyz", cookie: "sb=1" } },
      }),
    ).toEqual({
      user: "alice",
      password: "[REDACTED]",
      nested: {
        access_token: "[REDACTED]",
        apiKey: "[REDACTED]",
        headers: { Authorization: "[REDACTED]", cookie: "[REDACTED]" },
      },
    });
  });

  it("masks secrets embedded in strings", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJlLXZhbHVl";
    const text = redactString(
      `token ${jwt} key sb_secret_fake-value url postgres://admin:pa55@db:5432/x Bearer abcdefghijkl ?api_key=123&x=1`,
    );
    expect(text).not.toContain(jwt);
    expect(text).not.toContain("sb_secret_fake-value");
    expect(text).not.toContain("pa55");
    expect(text).not.toContain("abcdefghijkl");
    expect(text).toContain("api_key=[REDACTED]");
    expect(text).toContain("postgres://admin:[REDACTED]@db:5432/x");
  });

  it("serialises errors without leaking secrets in their messages", () => {
    const error = Object.assign(new Error("connect failed for postgres://u:secretpw@h/db"), { code: "ECONN" });
    const output = redact(error) as Record<string, unknown>;
    expect(output.message).toBe("connect failed for postgres://u:[REDACTED]@h/db");
    expect(output.code).toBe("ECONN");
  });

  it("survives circular structures", () => {
    const value: Record<string, unknown> = { name: "loop" };
    value.self = value;
    expect(redact(value)).toEqual({ name: "loop", self: "[Circular]" });
  });
});

describe("logger", () => {
  it("writes one JSON line with redacted context", () => {
    const write = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("login failed", { email: "a@b.c", password: "nope", error: new Error("token=abc") });
    expect(write).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(write.mock.calls[0][0]));
    expect(line).toMatchObject({ level: "error", msg: "login failed", email: "a@b.c", password: "[REDACTED]" });
    expect(line.error.message).toBe("token=[REDACTED]");
    expect(typeof line.time).toBe("string");
  });
});
