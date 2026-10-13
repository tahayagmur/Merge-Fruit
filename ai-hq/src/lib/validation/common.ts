import { z } from "zod";

export const idSchema = z.uuid({ message: "Must be a valid id." });

/** Optional free text: trims, turns "" into null, caps the length. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Must be at most ${max} characters.` })
    .nullish()
    .transform((value) => (value ? value : null));

export const requiredText = (label: string, max: number) =>
  z
    .string({ message: `${label} is required.` })
    .trim()
    .min(1, { message: `${label} is required.` })
    .max(max, { message: `${label} must be at most ${max} characters.` });

/** Calendar date in YYYY-MM-DD form, or null to clear it. */
export const optionalDate = z
  .union([z.iso.date({ message: "Use the YYYY-MM-DD format." }), z.literal("")])
  .nullish()
  .transform((value) => (value ? value : null));

export function requireAtLeastOneField<T extends Record<string, unknown>>(value: T) {
  return Object.values(value).some((field) => field !== undefined);
}

/**
 * Free-text search term. Only letters, digits, spaces and a few safe symbols
 * survive, so the value can be embedded in PostgREST filters (`or=(…)`,
 * `ilike`) without escaping and without LIKE wildcards from the user.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s@#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export const searchQuerySchema = z
  .string()
  .max(200)
  .optional()
  .transform((value) => {
    const term = value ? sanitizeSearchTerm(value) : "";
    return term.length >= 2 ? term : undefined;
  });

export const pageSchema = z.coerce.number().int().min(1).max(1000).default(1);

/** Strings from <select multiple>/checkbox groups arrive as one value or an array. */
export function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}
