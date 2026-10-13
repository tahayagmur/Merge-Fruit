import { z } from "zod";
import { ACTIVITY_ENTITY_TYPES } from "@/lib/domain";
import { searchQuerySchema } from "./common";

/** "mine": the caller's own feed. "workspace": every entry (owners and admins only). */
export const ACTIVITY_SCOPES = ["mine", "workspace"] as const;
export type ActivityScope = (typeof ACTIVITY_SCOPES)[number];

export const activityQuerySchema = z.strictObject({
  scope: z.enum(ACTIVITY_SCOPES).default("mine"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.number().int().positive().optional(),
  entityType: z.enum(ACTIVITY_ENTITY_TYPES).optional(),
  q: searchQuerySchema,
});

export type ActivityQuery = z.output<typeof activityQuerySchema>;
