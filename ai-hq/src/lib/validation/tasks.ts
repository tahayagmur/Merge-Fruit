import { z } from "zod";
import { PRIORITIES, TASK_STATUSES } from "@/lib/domain";
import { optionalDate, optionalText, requireAtLeastOneField, requiredText } from "./common";

const taskFields = {
  title: requiredText("Title", 200),
  description: optionalText(5000),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  dueDate: optionalDate,
};

export const taskCreateSchema = z.strictObject({
  title: taskFields.title,
  description: taskFields.description.optional().default(null),
  status: taskFields.status.default("todo"),
  priority: taskFields.priority.default("medium"),
  dueDate: taskFields.dueDate.optional().default(null),
});

export const taskUpdateSchema = z
  .strictObject({
    title: taskFields.title.optional(),
    description: taskFields.description.optional(),
    status: taskFields.status.optional(),
    priority: taskFields.priority.optional(),
    dueDate: taskFields.dueDate.optional(),
  })
  .refine(requireAtLeastOneField, { message: "Provide at least one field to update." });

export type TaskCreateInput = z.output<typeof taskCreateSchema>;
export type TaskUpdateInput = z.output<typeof taskUpdateSchema>;
