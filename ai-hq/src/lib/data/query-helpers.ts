import type { Page } from "@/lib/domain";

/** Builds a PostgREST `or` filter that searches several text columns for a sanitised term. */
export function searchFilter(columns: string[], term: string): string {
  // `term` comes from sanitizeSearchTerm(): no quotes, commas, parentheses or wildcards.
  return columns.map((column) => `${column}.ilike."%${term}%"`).join(",");
}

export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function toPage<T>(items: T[], total: number | null, page: number, pageSize: number): Page<T> {
  return { items, total: total ?? items.length, page, pageSize };
}
