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
