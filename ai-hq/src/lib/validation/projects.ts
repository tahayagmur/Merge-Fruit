import { z } from "zod";
import { PRIORITIES, PROJECT_CATEGORIES, PROJECT_STATUSES } from "@/lib/domain";
import { optionalDate, optionalText, requireAtLeastOneField, requiredText } from "./common";

const projectFields = {
  name: requiredText("Name", 120),
  description: optionalText(2000),
  status: z.enum(PROJECT_STATUSES),
  category: z.enum(PROJECT_CATEGORIES),
  priority: z.enum(PRIORITIES),
  dueDate: optionalDate,
};

export const projectCreateSchema = z.strictObject({
  ...projectFields,
  description: projectFields.description.optional().default(null),
  status: projectFields.status.default("planning"),
  category: projectFields.category.default("general"),
  priority: projectFields.priority.default("medium"),
  dueDate: projectFields.dueDate.optional().default(null),
});

export const projectUpdateSchema = z
  .strictObject({
    name: projectFields.name.optional(),
    description: projectFields.description.optional(),
    status: projectFields.status.optional(),
    category: projectFields.category.optional(),
    priority: projectFields.priority.optional(),
    dueDate: projectFields.dueDate.optional(),
  })
  .refine(requireAtLeastOneField, { message: "Provide at least one field to update." });

export const projectListQuerySchema = z.strictObject({
  status: z.enum(PROJECT_STATUSES).optional(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
});

export type ProjectListQuery = z.output<typeof projectListQuerySchema>;

export type ProjectCreateInput = z.output<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.output<typeof projectUpdateSchema>;
