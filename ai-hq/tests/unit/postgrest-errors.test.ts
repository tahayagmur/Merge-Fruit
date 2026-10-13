import { describe, expect, it } from "vitest";
import { mapPostgrestError } from "@/lib/api/postgrest-errors";

describe("mapPostgrestError", () => {
  it.each([
    ["PGRST116", "NOT_FOUND", 404],
    ["23514", "VALIDATION_ERROR", 400],
    ["22P02", "VALIDATION_ERROR", 400],
    ["23503", "CONFLICT", 409],
    ["23505", "CONFLICT", 409],
    ["42501", "FORBIDDEN", 403],
    ["PGRST301", "UNAUTHENTICATED", 401],
    ["XX000", "INTERNAL_ERROR", 500],
  ])("maps %s to %s", (code, expected, status) => {
    const error = mapPostgrestError({ code, message: 'relation "secret_table" does not exist' }, "Project");
    expect(error.code).toBe(expected);
    expect(error.status).toBe(status);
  });

  it("never forwards the raw database message", () => {
    const error = mapPostgrestError({ code: "XX000", message: 'column "password_hash" does not exist' });
    expect(error.message).not.toContain("password_hash");
  });
});
