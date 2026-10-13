import { describe, expect, it } from "vitest";
import { formatDate, formatRelativeTime, isOverdue, percentage, todayUtc } from "@/lib/format";

describe("format helpers", () => {
  it("formats calendar dates without time-zone shifts", () => {
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDate("2026-12-31", { short: true })).toBe("Dec 31");
    expect(formatDate(null)).toBe("—");
  });

  it("detects overdue work only for open items", () => {
    expect(isOverdue("2026-10-01", "todo", "2026-10-13")).toBe(true);
    expect(isOverdue("2026-10-01", "done", "2026-10-13")).toBe(false);
    expect(isOverdue("2026-10-13", "todo", "2026-10-13")).toBe(false);
    expect(isOverdue(null, "todo", "2026-10-13")).toBe(false);
  });

  it("formats relative times", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(formatRelativeTime("2026-10-13T11:59:30Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-10-13T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-10-12T12:00:00Z", now)).toBe("yesterday");
  });

  it("computes UTC dates and percentages", () => {
    expect(todayUtc(new Date("2026-10-13T23:30:00-05:00"))).toBe("2026-10-14");
    expect(percentage(1, 3)).toBe(33);
    expect(percentage(0, 0)).toBe(0);
  });
});
