const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

/** Formats a YYYY-MM-DD calendar date without shifting it across time zones. */
export function formatDate(date: string | null | undefined, options: { short?: boolean } = {}): string {
  if (!date) return "—";
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return (options.short ? shortDateFormatter : dateFormatter).format(parsed);
}

/** Today's date (UTC) as YYYY-MM-DD — matches the database's current_date on Supabase. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isOverdue(dueDate: string | null, status: string, today: string): boolean {
  return Boolean(dueDate) && status !== "done" && status !== "completed" && (dueDate as string) < today;
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(timestamp: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(timestamp).getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormatter.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
