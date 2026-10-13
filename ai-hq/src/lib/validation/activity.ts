import { z } from "zod";
import { ACTIVITY_ENTITY_TYPES } from "@/lib/domain";

export const activityQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.number().int().positive().optional(),
  entityType: z.enum(ACTIVITY_ENTITY_TYPES).optional(),
});

export type ActivityQuery = z.output<typeof activityQuerySchema>;
