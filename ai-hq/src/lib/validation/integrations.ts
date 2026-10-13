import { z } from "zod";

/** Envelope for integration updates; `settings` is validated against the integration's own schema. */
export const integrationUpdateSchema = z
  .strictObject({
    enabled: z.boolean().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => value.enabled !== undefined || value.settings !== undefined, {
    message: "Provide enabled or settings.",
  });

export const integrationKeySchema = z.string().regex(/^[a-z][a-z0-9_-]{1,39}$/, { message: "Unknown integration." });
