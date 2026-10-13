import { describe, expect, it } from "vitest";
import { buildPersonalExport } from "@/lib/data/export";
import type { AppSupabaseClient } from "@/lib/supabase/server";

/** Minimal PostgREST stand-in: records filters and serves rows page by page. */
function fakeSupabase(rowsPerTable: Record<string, number>) {
  const calls: Array<{ table: string; owner?: string; from: number; to: number }> = [];
  const client = {
    from(table: string) {
      const call: { table: string; owner?: string; from: number; to: number } = { table, from: 0, to: 0 };
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          if (column === "owner_id") call.owner = value;
          return builder;
        },
        order: () => builder,
        range: (from: number, to: number) => {
          call.from = from;
          call.to = to;
          calls.push(call);
          const total = rowsPerTable[table] ?? 0;
          const data = Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, index) => ({
            id: from + index,
            owner_id: call.owner,
          }));
          return Promise.resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as AppSupabaseClient, calls };
}

describe("personal data export", () => {
  it("reads every table page by page, filtered to the user", async () => {
    const { client, calls } = fakeSupabase({ projects: 1100, tasks: 3, activity_logs: 500 });
    const result = await buildPersonalExport(client, { id: "u1", email: "a@b.c" }, new Date("2026-10-13T10:00:00Z"));

    expect(result).toMatchObject({ format: "ai-hq-export", version: 1, exportedAt: "2026-10-13T10:00:00.000Z" });
    expect(result.projects).toHaveLength(1100);
    expect(result.tasks).toHaveLength(3);
    expect(result.activity).toHaveLength(500);
    expect(result.agents).toEqual([]);
    expect(calls.every((call) => call.owner === "u1")).toBe(true);
    // 1100 rows → pages of 500: 0-499, 500-999, 1000-1499.
    expect(calls.filter((call) => call.table === "projects").map((call) => call.from)).toEqual([0, 500, 1000]);
    // Exactly one full page needs one more (empty) read to be sure nothing is left.
    expect(calls.filter((call) => call.table === "activity_logs")).toHaveLength(2);
  });
});
